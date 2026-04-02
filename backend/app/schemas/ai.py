from pydantic import BaseModel
from datetime import datetime


class CreateConversationRequest(BaseModel):
    preset: str  # "overall_analysis" | "topic_inspiration" | "video_analysis"


class SendMessageRequest(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: int
    role: str  # "user" | "assistant"
    content: str | None
    tool_calls: list[str] | None = None  # function names called by this assistant message
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationSummary(BaseModel):
    id: int
    preset: str
    title: str | None
    created_at: datetime
    updated_at: datetime | None
    message_count: int = 0

    class Config:
        from_attributes = True


class ConversationDetail(BaseModel):
    id: int
    preset: str
    title: str | None
    query_id: int | None
    bvid: str | None
    messages: list[MessageResponse]

    class Config:
        from_attributes = True
