"""Core AI agent service: function calling loop, message persistence, OpenAI client."""
import json
from datetime import datetime
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AppSettings
from app.models.conversation import AIConversation, AIMessage
from app.core.security import decrypt_value
from app.services.ai_tools import execute_tool


async def get_openai_client(db: AsyncSession) -> tuple[AsyncOpenAI, str]:
    """Load AI settings, decrypt key, create AsyncOpenAI client. Returns (client, model)."""
    base_url_row = await db.get(AppSettings, "ai_base_url")
    api_key_row = await db.get(AppSettings, "ai_api_key")
    model_row = await db.get(AppSettings, "ai_model")

    base_url = base_url_row.value if base_url_row else "https://api.openai.com/v1"
    api_key = ""
    if api_key_row and api_key_row.value:
        api_key = decrypt_value(api_key_row.value) if api_key_row.is_sensitive else api_key_row.value
    model = model_row.value if model_row else "gpt-4o"

    if not api_key:
        raise ValueError("AI API key not configured")

    client = AsyncOpenAI(base_url=base_url, api_key=api_key)
    return client, model


def build_messages_from_db(messages: list[AIMessage]) -> list[dict]:
    """Reconstruct OpenAI-format messages from stored DB rows."""
    result = []
    for msg in messages:
        entry: dict = {"role": msg.role}
        if msg.content is not None:
            entry["content"] = msg.content
        if msg.tool_calls:
            entry["tool_calls"] = json.loads(msg.tool_calls)
            if "content" not in entry:
                entry["content"] = None
        if msg.tool_call_id:
            entry["tool_call_id"] = msg.tool_call_id
        if msg.name:
            entry["name"] = msg.name
        result.append(entry)
    return result


async def save_message(
    db: AsyncSession, conv_id: int, role: str,
    content: str | None = None, tool_calls: str | None = None,
    tool_call_id: str | None = None, name: str | None = None,
) -> AIMessage:
    """Persist a message row and flush."""
    msg = AIMessage(
        conversation_id=conv_id, role=role, content=content,
        tool_calls=tool_calls, tool_call_id=tool_call_id, name=name,
        created_at=datetime.utcnow(),
    )
    db.add(msg)
    await db.flush()
    return msg


async def stream_agent_response(
    client: AsyncOpenAI, model: str, messages: list[dict],
    tools: list[dict], db: AsyncSession, context: dict, conv_id: int,
):
    """Core function calling loop. Yields SSE event dicts.

    Events:
      {type: "content", content: str}
      {type: "tool_start", name: str}
      {type: "tool_end", name: str}
      {type: "done"}
      {type: "error", error: str}
    """
    max_iterations = 10

    for _iteration in range(max_iterations):
        try:
            stream = await client.chat.completions.create(
                model=model, messages=messages, tools=tools if tools else None,
                stream=True,
            )
        except Exception as e:
            yield {"type": "error", "error": str(e)}
            return

        content_parts: list[str] = []
        tool_calls_by_index: dict[int, dict] = {}

        try:
            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if not delta:
                    continue

                # Content streaming
                if delta.content:
                    content_parts.append(delta.content)
                    yield {"type": "content", "content": delta.content}

                # Tool call accumulation
                if delta.tool_calls:
                    for tc_delta in delta.tool_calls:
                        idx = tc_delta.index
                        if idx not in tool_calls_by_index:
                            tool_calls_by_index[idx] = {
                                "id": tc_delta.id or "",
                                "type": "function",
                                "function": {"name": "", "arguments": ""},
                            }
                        entry = tool_calls_by_index[idx]
                        if tc_delta.id:
                            entry["id"] = tc_delta.id
                        if tc_delta.function:
                            if tc_delta.function.name:
                                entry["function"]["name"] += tc_delta.function.name
                            if tc_delta.function.arguments:
                                entry["function"]["arguments"] += tc_delta.function.arguments
        except Exception as e:
            yield {"type": "error", "error": str(e)}
            return

        # Save assistant message
        full_content = "".join(content_parts) or None
        tool_calls_list = [tool_calls_by_index[i] for i in sorted(tool_calls_by_index)] if tool_calls_by_index else None
        tool_calls_json = json.dumps(tool_calls_list) if tool_calls_list else None

        await save_message(db, conv_id, "assistant", content=full_content, tool_calls=tool_calls_json)

        if tool_calls_list:
            # Execute each tool call
            messages.append({
                "role": "assistant", "content": full_content,
                "tool_calls": tool_calls_list,
            })

            for tc in tool_calls_list:
                fn_name = tc["function"]["name"]
                try:
                    fn_args = json.loads(tc["function"]["arguments"]) if tc["function"]["arguments"] else {}
                except json.JSONDecodeError:
                    fn_args = {}

                yield {"type": "tool_start", "name": fn_name, "arguments": fn_args}

                result_str = await execute_tool(fn_name, fn_args, db, context)

                # Save tool response message
                await save_message(
                    db, conv_id, "tool", content=result_str,
                    tool_call_id=tc["id"], name=fn_name,
                )

                messages.append({
                    "role": "tool", "content": result_str,
                    "tool_call_id": tc["id"], "name": fn_name,
                })

                yield {"type": "tool_end", "name": fn_name, "result": result_str}

            # Continue loop — AI will process tool results
            continue
        else:
            # No tool calls — we're done
            await db.commit()
            yield {"type": "done"}
            return

    # Max iterations reached
    await db.commit()
    yield {"type": "done"}
