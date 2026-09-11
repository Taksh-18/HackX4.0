import os
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "disaster.db"
DB_PATH = Path(os.getenv("DISASTER_DB_PATH", DEFAULT_DB_PATH))
DB_PATH = DB_PATH.expanduser().resolve()
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
engine = create_engine(
    f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


@event.listens_for(engine, "connect")
def enable_foreign_keys(connection, _):
    cursor = connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def init_db():
    from app import models  # noqa: F401 -- register tables before create_all

    Base.metadata.create_all(engine)


def get_db():
    with SessionLocal() as session:
        yield session
