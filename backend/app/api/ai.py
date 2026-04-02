"""AI conversation endpoints with function calling and SSE streaming."""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse
from app.core.deps import get_db
from app.models import Query, Video
from app.models.conversation import AIConversation, AIMessage
from app.schemas.ai import (
    CreateConversationRequest, SendMessageRequest,
    ConversationSummary, ConversationDetail, MessageResponse,
)
from app.services.ai_prompts import get_system_prompt, get_initial_message
from app.services.ai_service import (
    get_openai_client, build_messages_from_db, save_message, stream_agent_response,
)
from app.services.ai_tools import get_tools_for_scope

router = APIRouter()


def _detect_lang(request: Request) -> str:
    accept = request.headers.get("Accept-Language", "")
    return "en" if accept.startswith("en") else "zh"


async def _list_conversations(db: AsyncSession, query_id: int | None, bvid: str | None):
    stmt = select(
        AIConversation,
        func.count(AIMessage.id).label("msg_count"),
    ).outerjoin(AIMessage).group_by(AIConversation.id)

    if query_id is not None:
        stmt = stmt.where(AIConversation.query_id == query_id)
    if bvid is not None:
        stmt = stmt.where(AIConversation.bvid == bvid)

    stmt = stmt.order_by(AIConversation.updated_at.desc())
    result = await db.execute(stmt)

    return [
        ConversationSummary(
            id=conv.id, preset=conv.preset, title=conv.title,
            created_at=conv.created_at, updated_at=conv.updated_at,
            message_count=msg_count,
        )
        for conv, msg_count in result.all()
    ]


async def _get_conversation_detail(db: AsyncSession, conv_id: int):
    conv = await db.get(AIConversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    result = await db.execute(
        select(AIMessage)
        .where(AIMessage.conversation_id == conv_id)
        .order_by(AIMessage.created_at)
    )
    all_msgs = result.scalars().all()

    # Filter to user/assistant messages with content for display
    # For assistant messages, extract tool function names from tool_calls JSON
    visible = []
    for m in all_msgs:
        if m.role == "user" and m.content:
            visible.append(MessageResponse(
                id=m.id, role=m.role, content=m.content, created_at=m.created_at,
            ))
        elif m.role == "assistant" and (m.content or m.tool_calls):
            tool_names = None
            if m.tool_calls:
                try:
                    tc_list = json.loads(m.tool_calls)
                    tool_names = [tc["function"]["name"] for tc in tc_list if tc.get("function", {}).get("name")]
                except (json.JSONDecodeError, KeyError, TypeError):
                    pass
            # Only include if there's actual content or tool_calls to show
            if m.content or tool_names:
                visible.append(MessageResponse(
                    id=m.id, role=m.role, content=m.content,
                    tool_calls=tool_names, created_at=m.created_at,
                ))

    return ConversationDetail(
        id=conv.id, preset=conv.preset, title=conv.title,
        query_id=conv.query_id, bvid=conv.bvid, messages=visible,
    )


async def _create_conversation_stream(
    db: AsyncSession, request: Request,
    query_id: int | None, bvid: str | None, body: CreateConversationRequest,
):
    preset = body.preset
    lang = _detect_lang(request)

    # Validate context
    if query_id is not None:
        query = await db.get(Query, query_id)
        if not query or query.status != "done":
            raise HTTPException(status_code=400, detail="Query not ready")
    if bvid is not None:
        video = await db.get(Video, bvid)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")

    # Determine scope and title
    scope = "video" if (bvid and preset == "video_analysis") else "query"
    title_prefix = {"overall_analysis": "Overall", "topic_inspiration": "Topics", "video_analysis": "Video"}
    title = f"{title_prefix.get(preset, 'AI')} - {datetime.utcnow().strftime('%m/%d %H:%M')}"

    # Create conversation
    conv = AIConversation(
        query_id=query_id, bvid=bvid, preset=preset, title=title,
        created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
    )
    db.add(conv)
    await db.flush()

    # Save system + initial user messages
    system_content = get_system_prompt(preset, lang)
    initial_msg = get_initial_message(preset)
    await save_message(db, conv.id, "system", content=system_content)
    await save_message(db, conv.id, "user", content=initial_msg)
    await db.flush()

    # Build OpenAI messages
    messages = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": initial_msg},
    ]
    tools = get_tools_for_scope(scope)
    context = {"query_id": query_id, "bvid": bvid}

    try:
        client, model = await get_openai_client(db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    async def event_generator():
        yield {"event": "message", "data": json.dumps({
            "type": "conversation_created", "conversation_id": conv.id,
        })}
        yield {"event": "message", "data": json.dumps({
            "type": "user_message", "content": initial_msg,
        })}
        try:
            async for event in stream_agent_response(client, model, messages, tools, db, context, conv.id):
                yield {"event": "message", "data": json.dumps(event)}
        except Exception as e:
            yield {"event": "message", "data": json.dumps({"type": "error", "error": str(e)})}

    return EventSourceResponse(event_generator())


async def _send_message_stream(
    db: AsyncSession, request: Request, conv_id: int, body: SendMessageRequest,
):
    conv = await db.get(AIConversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    lang = _detect_lang(request)

    # Save user message
    await save_message(db, conv.id, "user", content=body.content)
    conv.updated_at = datetime.utcnow()
    await db.flush()

    # Rebuild full message history
    result = await db.execute(
        select(AIMessage)
        .where(AIMessage.conversation_id == conv_id)
        .order_by(AIMessage.created_at)
    )
    all_msgs = result.scalars().all()
    messages = build_messages_from_db(all_msgs)

    scope = "video" if (conv.bvid and conv.preset == "video_analysis") else "query"
    tools = get_tools_for_scope(scope)
    context = {"query_id": conv.query_id, "bvid": conv.bvid}

    try:
        client, model = await get_openai_client(db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    async def event_generator():
        try:
            async for event in stream_agent_response(client, model, messages, tools, db, context, conv.id):
                yield {"event": "message", "data": json.dumps(event)}
        except Exception as e:
            yield {"event": "message", "data": json.dumps({"type": "error", "error": str(e)})}

    return EventSourceResponse(event_generator())


async def _delete_conversation(db: AsyncSession, conv_id: int):
    conv = await db.get(AIConversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(conv)
    await db.commit()


# --- Query-scoped endpoints ---

@router.get("/queries/{query_id}/ai/conversations", response_model=list[ConversationSummary])
async def list_query_conversations(query_id: int, db: AsyncSession = Depends(get_db)):
    return await _list_conversations(db, query_id=query_id, bvid=None)


@router.post("/queries/{query_id}/ai/conversations")
async def create_query_conversation(
    query_id: int, body: CreateConversationRequest,
    request: Request, db: AsyncSession = Depends(get_db),
):
    return await _create_conversation_stream(db, request, query_id=query_id, bvid=None, body=body)


@router.get("/queries/{query_id}/ai/conversations/{conv_id}", response_model=ConversationDetail)
async def get_query_conversation(query_id: int, conv_id: int, db: AsyncSession = Depends(get_db)):
    return await _get_conversation_detail(db, conv_id)


@router.delete("/queries/{query_id}/ai/conversations/{conv_id}", status_code=204)
async def delete_query_conversation(query_id: int, conv_id: int, db: AsyncSession = Depends(get_db)):
    await _delete_conversation(db, conv_id)


@router.post("/queries/{query_id}/ai/conversations/{conv_id}/messages")
async def send_query_message(
    query_id: int, conv_id: int, body: SendMessageRequest,
    request: Request, db: AsyncSession = Depends(get_db),
):
    return await _send_message_stream(db, request, conv_id, body)


# --- Video-scoped endpoints ---

@router.get("/videos/{bvid}/ai/conversations", response_model=list[ConversationSummary])
async def list_video_conversations(bvid: str, db: AsyncSession = Depends(get_db)):
    return await _list_conversations(db, query_id=None, bvid=bvid)


@router.post("/videos/{bvid}/ai/conversations")
async def create_video_conversation(
    bvid: str, body: CreateConversationRequest,
    request: Request, db: AsyncSession = Depends(get_db),
):
    # Resolve query_id from the first query containing this video
    from app.models import QueryVideo
    result = await db.execute(select(QueryVideo.query_id).where(QueryVideo.bvid == bvid).limit(1))
    row = result.first()
    query_id = row[0] if row else None
    return await _create_conversation_stream(db, request, query_id=query_id, bvid=bvid, body=body)


@router.get("/videos/{bvid}/ai/conversations/{conv_id}", response_model=ConversationDetail)
async def get_video_conversation(bvid: str, conv_id: int, db: AsyncSession = Depends(get_db)):
    return await _get_conversation_detail(db, conv_id)


@router.delete("/videos/{bvid}/ai/conversations/{conv_id}", status_code=204)
async def delete_video_conversation(bvid: str, conv_id: int, db: AsyncSession = Depends(get_db)):
    await _delete_conversation(db, conv_id)


@router.post("/videos/{bvid}/ai/conversations/{conv_id}/messages")
async def send_video_message(
    bvid: str, conv_id: int, body: SendMessageRequest,
    request: Request, db: AsyncSession = Depends(get_db),
):
    return await _send_message_stream(db, request, conv_id, body)
