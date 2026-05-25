from pydantic import BaseModel
from typing import List, Optional

class AIEnrichment(BaseModel):
    description: str
    tags: List[str]

class ProductCreatedEvent(BaseModel):
    product_id: int
    image_url: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
