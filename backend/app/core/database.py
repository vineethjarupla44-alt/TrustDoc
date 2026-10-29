from sqlalchemy import create_engine, JSON, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.core.config import settings

# Dialect-agnostic JSON: maps to native JSONB on PostgreSQL and JSON on SQLite
JSONType = JSON().with_variant(JSONB, "postgresql")

is_sqlite = settings.DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    echo=False
)

# Enable WAL mode on SQLite for concurrency
if is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_db_schema():
    """Ensure all required columns exist in SQLite database safely."""
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if "users" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("users")]
        with engine.connect() as conn:
            if "approval_status" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN approval_status VARCHAR(50) DEFAULT 'APPROVED'"))
            if "employee_id" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN employee_id VARCHAR(100)"))
            if "department" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN department VARCHAR(150)"))
            if "designation" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN designation VARCHAR(150)"))
            if "phone_number" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN phone_number VARCHAR(50)"))
            if "rejection_reason" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN rejection_reason TEXT"))
            conn.commit()


