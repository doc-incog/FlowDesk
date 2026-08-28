import type { DatabaseSync } from "node:sqlite"

/** Users table DDL — shared with the in-place migration in lib/db. */
export const USERS_TABLE_DDL = `(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_initials TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  batch TEXT,
  semester TEXT,
  roll_no TEXT,
  mentor_id TEXT,
  designation TEXT,
  subjects TEXT,
  phone TEXT,
  address TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  emergency_contact TEXT,
  dob TEXT
)`

export function createSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users ${USERS_TABLE_DDL};

    CREATE TABLE IF NOT EXISTS roles (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      blurb TEXT NOT NULL,
      accent TEXT NOT NULL,
      builtin INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role TEXT NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
      section TEXT NOT NULL,
      PRIMARY KEY (role, section)
    );

    CREATE TABLE IF NOT EXISTS user_permissions (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      section TEXT NOT NULL,
      PRIMARY KEY (user_id, section)
    );


    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS mentors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      designation TEXT NOT NULL,
      department TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      office TEXT NOT NULL,
      office_hours TEXT NOT NULL,
      avatar_initials TEXT NOT NULL,
      mentees INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      time TEXT NOT NULL,
      category TEXT NOT NULL,
      unread INTEGER NOT NULL DEFAULT 1,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      target_role TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

    CREATE TABLE IF NOT EXISTS schedule_slots (
      id TEXT PRIMARY KEY,
      day TEXT NOT NULL,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      module TEXT NOT NULL,
      code TEXT NOT NULL,
      room TEXT NOT NULL,
      staff TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_slots_day ON schedule_slots(day);

    CREATE TABLE IF NOT EXISTS check_ins (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('on-time','late','absent')),
      method TEXT NOT NULL,
      device_id TEXT,
      source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web','device')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_checkins_user_day ON check_ins(user_id, created_at);

    CREATE TABLE IF NOT EXISTS fee_items (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('paid','pending')),
      paid_date TEXT,
      method TEXT,
      receipt_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fee_student ON fee_items(student_id);

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      item_name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      date TEXT NOT NULL,
      method TEXT NOT NULL,
      transaction_id TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_receipts_student ON receipts(student_id);

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      module_code TEXT NOT NULL,
      module_name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      assigned_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      max_marks INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT,
      marks INTEGER,
      feedback TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);

    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      module_code TEXT NOT NULL,
      module_name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('midterm','final','practical')),
      date TEXT NOT NULL,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      room TEXT NOT NULL,
      max_marks INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS results (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL,
      marks INTEGER NOT NULL,
      max_marks INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_results_student ON results(student_id);

    CREATE TABLE IF NOT EXISTS scholarships (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      amount INTEGER NOT NULL,
      eligibility TEXT NOT NULL,
      seats INTEGER NOT NULL,
      deadline TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scholarship_applications (
      id TEXT PRIMARY KEY,
      scholarship_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('submitted','under-review','approved','rejected')),
      submitted_at TEXT NOT NULL,
      docs TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scholar_student ON scholarship_applications(student_id);

    CREATE TABLE IF NOT EXISTS programs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      duration TEXT NOT NULL,
      seats INTEGER NOT NULL,
      deadline TEXT NOT NULL,
      fee INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admission_applications (
      id TEXT PRIMARY KEY,
      applicant_name TEXT NOT NULL,
      email TEXT NOT NULL,
      program_id TEXT NOT NULL,
      program_name TEXT NOT NULL,
      score INTEGER NOT NULL,
      docs TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('submitted','reviewing','accepted','rejected')),
      submitted_at TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('open','in-progress','resolved')),
      created_at TEXT NOT NULL,
      raised_by_name TEXT NOT NULL,
      raised_by_role TEXT NOT NULL,
      raised_by_id TEXT,
      comments TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS feedback_targets (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      subtitle TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback_entries (
      id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      by_id TEXT,
      by_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      data BLOB NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'direct',
      title TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TEXT NOT NULL,
      last_read_at TEXT,
      PRIMARY KEY (conversation_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS fingerprint_templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      finger_id INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      template BLOB,
      enrolled_by TEXT,
      enrolled_at TEXT NOT NULL,
      UNIQUE(user_id, device_id, finger_id)
    );
    CREATE INDEX IF NOT EXISTS idx_fp_user ON fingerprint_templates(user_id);
    CREATE INDEX IF NOT EXISTS idx_fp_device ON fingerprint_templates(device_id);

    CREATE TABLE IF NOT EXISTS fingerprint_commands (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      command TEXT NOT NULL,
      params TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','completed','failed')),
      created_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fp_cmd_device ON fingerprint_commands(device_id, status);

    CREATE TABLE IF NOT EXISTS fingerprint_devices (
      device_id TEXT PRIMARY KEY,
      label TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      device_secret TEXT,
      sensor_type TEXT NOT NULL DEFAULT 'R307',
      status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved','disabled')),
      last_seen TEXT,
      enrolled_count INTEGER NOT NULL DEFAULT 0,
      slots_total INTEGER NOT NULL DEFAULT 162,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fingerprint_device_health (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL REFERENCES fingerprint_devices(device_id) ON DELETE CASCADE,
      sensor_connected INTEGER NOT NULL,
      sensor_capacity INTEGER,
      free_memory INTEGER,
      wifi_rssi INTEGER,
      uptime_seconds INTEGER,
      recorded_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fp_health_device ON fingerprint_device_health(device_id, recorded_at);
  `)
}
