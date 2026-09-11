import os
from datetime import UTC
from pathlib import Path

from sqlalchemy import DateTime, create_engine, event
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.types import TypeDecorator


class Base(DeclarativeBase):
    pass


class UTCDateTime(TypeDecorator):
    """Store UTC in SQLite and restore aware datetimes when reading.

    SQLite does not retain timezone offsets with DateTime(timezone=True).
    Naive input and legacy naive database values are interpreted as UTC.
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value, dialect):
        return value.replace(tzinfo=UTC) if value is not None else None


def create_sqlite_engine(path):
    """Create a SQLite engine with foreign keys enabled on every connection."""
    path = Path(path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    db_engine = create_engine(
        URL.create("sqlite", database=str(path)),
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(db_engine, "connect")
    def enable_foreign_keys(connection, _):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return db_engine


DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "disaster.db"
DB_PATH = Path(os.getenv("DISASTER_DB_PATH", DEFAULT_DB_PATH))
DB_PATH = DB_PATH.expanduser().resolve()
engine = create_sqlite_engine(DB_PATH)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def init_db():
    from app import models  # noqa: F401 -- register tables before create_all

    Base.metadata.create_all(engine)


def get_db():
    with SessionLocal() as session:
        yield session
