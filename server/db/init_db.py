from models.stock import Base
from db.database import engine


def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
