/**
 * Mock Supabase client for unit testing.
 * Simulates RLS-equivalent behavior.
 */

type Role = "dancer" | "coach" | "admin";

interface MockUser {
  id: string;
  role: Role;
}

interface MockAuth {
  uid: () => string | null;
  user: () => MockUser | null;
  getUser: () => Promise<{ data: { user: MockUser | null }; error: any }>;
  onAuthStateChange: () => { data: { subscription: { remove: () => void } } };
}

interface MockQueryBuilder {
  select: (columns?: string) => MockQueryBuilder;
  eq: (column: string, value: any) => MockQueryBuilder;
  maybeSingle: () => Promise<{ data: any; error: any }>;
  single: () => Promise<{ data: any; error: any }>;
  insert: (record: any) => MockQueryBuilder;
  upsert: (record: any) => MockQueryBuilder;
  update: (record: any) => MockQueryBuilder;
  delete: () => MockQueryBuilder;
  order: (column: string, opts?: any) => MockQueryBuilder;
  then: <TResult1 = any, TResult2 = never>(onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null | undefined, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined) => PromiseLike<TResult1 | TResult2>;
}

function makeQb(tableName: string, data: any[], authUser: any, isAdmin: boolean): MockQueryBuilder {
  let filters: ((row: any) => boolean)[] = [];

  const rlsFilter = (row: any) => {
    if (isAdmin) return true;
    // Tables where id === user_id: users, coach_profiles
    const idIsUser = tableName === "users" || tableName === "coach_profiles";
    if (tableName === "admin_actions") {
      return row.target_user_id === authUser?.id || row.admin_id === authUser?.id;
    }
    if (row.user_id && row.user_id !== authUser?.id) return false;
    if (idIsUser && row.id && row.id !== authUser?.id) return false;
    return true;
  };

  const applyFilters = () => data.filter((row) => rlsFilter(row) && filters.every((f) => f(row)));

  const qb: MockQueryBuilder = {
    select: () => qb,
    eq: (column: string, value: any) => {
      filters.push((row) => row[column] === value);
      return qb;
    },
    maybeSingle: async () => {
      const results = applyFilters();
      return { data: results.length > 0 ? results[0] : null, error: null };
    },
    single: async () => {
      const results = applyFilters();
      return { data: results.length > 0 ? results[0] : null, error: null };
    },
    insert: (record: any) => {
      if (!isAdmin) {
        // RLS on insert: user_id or id must match auth.uid()
        const idIsUser = tableName === "users" || tableName === "coach_profiles";
        if (record.user_id && record.user_id !== authUser?.id) return qb;
        if (idIsUser && record.id && record.id !== authUser?.id) return qb;
        if (tableName === "admin_actions") return qb; // non-admin cannot insert admin_actions
      }
      data.push(record);
      return qb;
    },
    upsert: (record: any) => {
      const idx = data.findIndex((r) => r.id === record.id);
      if (idx >= 0) data[idx] = record;
      else data.push(record);
      return qb;
    },
    update: (record: any) => {
      applyFilters().forEach((row) => {
        Object.assign(row, record);
      });
      return qb;
    },
    delete: () => {
      data = data.filter((row) => !filters.some((f) => f(row)));
      return qb;
    },
    order: () => qb,
    then: <_TResult1 = any, _TResult2 = never>(onfulfilled?: any, onrejected?: any) => Promise.resolve({ data: [], error: null }) as any,
  };
  return qb;
}

export function createMockSupabase(authUser: MockUser | null) {
  const auth: MockAuth = {
    uid: () => authUser?.id ?? null,
    user: () => authUser,
    getUser: () => Promise.resolve({ data: { user: authUser }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { remove: () => {} } } }),
  };

  const isAdmin = authUser?.role === "admin";

  // Fresh isolated db per mock instance
  const mockDb: Record<string, any[]> = {
    users: [],
    coach_applications: [],
    coach_profiles: [],
    admin_actions: [],
    venues: [],
    venue_media: [],
    coach_availability: [],
  };

  const from = (tableName: string): MockQueryBuilder => {
    const tableData = mockDb[tableName] || [];
    return makeQb(tableName, tableData, authUser, isAdmin);
  };

  const rpc = async (fn: string, params: any) => {
    if (!isAdmin) {
      return { data: null, error: { message: "Only admins can perform this action" } };
    }

    switch (fn) {
      case "approve_coach_application": {
        const appIdx = mockDb.coach_applications.findIndex(
          (a) => a.id === params.p_application_id
        );
        if (appIdx < 0) return { data: null, error: { message: "Not found" } };
        mockDb.coach_applications[appIdx].status = "approved";
        mockDb.coach_applications[appIdx].reviewed_by = authUser?.id;
        mockDb.coach_applications[appIdx].reviewed_at = new Date().toISOString();
        mockDb.admin_actions.push({
          admin_id: authUser?.id,
          action_type: "approve",
          target_user_id: mockDb.coach_applications[appIdx].user_id,
          target_application_id: params.p_application_id,
          note: params.p_admin_note,
        });
        return { data: mockDb.coach_applications[appIdx], error: null };
      }
      case "needs_changes_coach_application": {
        const appIdx = mockDb.coach_applications.findIndex(
          (a) => a.id === params.p_application_id
        );
        if (appIdx < 0) return { data: null, error: { message: "Not found" } };
        mockDb.coach_applications[appIdx].status = "needs_changes";
        mockDb.coach_applications[appIdx].admin_note = params.p_admin_note;
        mockDb.admin_actions.push({
          admin_id: authUser?.id,
          action_type: "needs_changes",
          target_user_id: mockDb.coach_applications[appIdx].user_id,
          target_application_id: params.p_application_id,
          note: params.p_admin_note,
        });
        return { data: mockDb.coach_applications[appIdx], error: null };
      }
      case "reject_coach_application": {
        const appIdx = mockDb.coach_applications.findIndex(
          (a) => a.id === params.p_application_id
        );
        if (appIdx < 0) return { data: null, error: { message: "Not found" } };
        mockDb.coach_applications[appIdx].status = "rejected";
        mockDb.coach_applications[appIdx].admin_note = params.p_reason;
        mockDb.admin_actions.push({
          admin_id: authUser?.id,
          action_type: "reject",
          target_user_id: mockDb.coach_applications[appIdx].user_id,
          target_application_id: params.p_application_id,
          note: params.p_reason,
        });
        return { data: mockDb.coach_applications[appIdx], error: null };
      }
      case "pause_coach":
      case "resume_coach": {
        const profileIdx = mockDb.coach_profiles.findIndex(
          (p) => p.id === params.p_coach_id
        );
        if (profileIdx < 0) return { data: null, error: { message: "Not found" } };
        mockDb.coach_profiles[profileIdx].is_paused = fn === "pause_coach";
        mockDb.admin_actions.push({
          admin_id: authUser?.id,
          action_type: fn === "pause_coach" ? "pause" : "resume",
          target_user_id: params.p_coach_id,
          note: params.p_admin_note,
        });
        return { data: mockDb.coach_profiles[profileIdx], error: null };
      }
      default:
        return { data: null, error: { message: "Unknown function" } };
    }
  };

  return {
    auth,
    from,
    rpc,
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: null }),
        remove: async () => ({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://example.com/file.jpg" } }),
      }),
    },
  };
}
