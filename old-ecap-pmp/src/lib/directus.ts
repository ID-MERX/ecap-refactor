import { getStoredToken } from "@/lib/auth";
import { getDirectusBaseUrl } from "@/lib/env";
const DIRECTUS_USER_ROLE = import.meta.env.VITE_DIRECTUS_USER_ROLE;

const requireDirectusUrl = () => {
  const directusUrl = getDirectusBaseUrl();
  if (!directusUrl) {
    throw new Error("REACT_APP_BASE_URL is not set");
  }
  return directusUrl;
};

const safeJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const directusRequest = async (path: string, options: RequestInit = {}) => {
  const token = getStoredToken();
  if (!token) {
    throw new Error("Not authenticated.");
  }
  const baseUrl = requireDirectusUrl().replace(/\/$/, "");

  // Don't set Content-Type for FormData (let browser set it with boundary)
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (options.headers) {
    const customHeaders = new Headers(options.headers);
    customHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  const data = await safeJson(response);

  if (!response.ok) {
    throw new Error(data?.errors?.[0]?.message ?? "Directus request failed");
  }

  return data;
};

export type DirectusUser = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string | { id: string; name?: string };
  status?: string;
  description?: string;
  title?: string;
  location?: string;
  avatar?: string; // File ID for profile picture
  last_access?: string;
  password_change_required?: boolean;
};

export type DirectusRole = {
  id: string;
  name: string;
};

export const listUsers = async (status?: string) => {
  const params = new URLSearchParams({
    fields:
      "id,email,first_name,last_name,role.id,role.name,status,description,title,location,facility,avatar,last_access,password_change_required",
    limit: "-1", // Fetch all users for chat list
  });
  if (DIRECTUS_USER_ROLE) {
    // If we filter by role ID, we might miss Support users if they have a different role ID.
    // Usually DIRECTUS_USER_ROLE is the "ECAP+ User" role.
    // If we want ALL users (including support), we might need to remove this filter
    // or ensure we are fetching multiple roles.
    // For now, let's assume we want to fetch all users to handle the cross-role chat logic
    // But strict security might prevent listing all.
    // Let's rely on the user's permissions.
    // params.set("filter[role][_eq]", DIRECTUS_USER_ROLE);
  }
  if (status) {
    params.set("filter[status][_eq]", status);
  }
  const data = await directusRequest(`/users?${params.toString()}`);
  return data?.data ?? [];
};

export const getUser = async (id: string) => {
  const data = await directusRequest(
    `/users/${encodeURIComponent(id)}?fields=id,email,first_name,last_name,role.id,role.name,status,description,title,location,facility,avatar,last_access,password_change_required`,
  );
  return data?.data;
};

// ... existing listRoles, createUser, updateUser, deleteUser ...

export type ChatMessage = Notification & {
  sender_user?: DirectusUser; // We will populate this manually if needed
};

// Chat Messages using Directus Notifications
export const getChatMessages = async (userId: string) => {
  if (!userId) return [];

  const params = new URLSearchParams({
    sort: "timestamp",
    limit: "500",
    fields:
      "id,status,timestamp,sender,recipient,subject,message,collection,item",
    "filter[recipient][_eq]": userId,
    "filter[sender][_nnull]": "true",
    "filter[collection][_in]": "support_chat,support_chat_outbox",
  });

  const data = await directusRequest(`/notifications?${params.toString()}`);
  return data?.data ?? [];
};

export const sendChatMessage = async (
  recipientId: string,
  message: string,
  priority: string = "Normal",
  fileId?: string,
  senderId?: string,
) => {
  let currentSenderId = senderId;

  // Get current user ID if not provided
  if (!currentSenderId) {
    const me = await directusRequest("/users/me?fields=id");
    currentSenderId = me?.data?.id;
  }

  if (!currentSenderId) {
    throw new Error("Could not determine sender ID");
  }

  // Send to recipient - CRITICAL: set sender field explicitly
  const payload: any = {
    recipient: recipientId,
    sender: currentSenderId, // ✅ Explicitly set sender
    subject: priority,
    message: message,
    collection: "support_chat",
    item: fileId || null,
  };

  const sent = await createNotification(payload);

  // Create outbox copy for sender
  try {
    await createNotification({
      recipient: currentSenderId,
      sender: currentSenderId, // Also set sender for outbox
      subject: priority,
      message: fileId ? `${message}|||FILE:${fileId}` : message,
      collection: "support_chat_outbox",
      item: recipientId, // ALWAYS store partner ID for conversation filtering
    });
  } catch (e) {
    console.warn("Failed to save outbox message", e);
  }

  return sent;
};

// Delete a single chat notification (inbox or outbox) that the current user owns
export const deleteChatMessage = async (id: string) => {
  if (!id) return;
  await directusRequest(`/notifications/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
};

// File Upload to Directus
export const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const data = await directusRequest("/files", {
    method: "POST",
    body: formData,
  });

  return data?.data;
};

// Update User Avatar
export const updateUserAvatar = async (
  userId: string,
  fileId: string | null,
) => {
  const data = await directusRequest(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ avatar: fileId }),
  });
  return data?.data;
};

// Get file URL (includes auth token for private assets)
export const getFileUrl = (fileId: string | null | undefined) => {
  if (!fileId) return "";
  const token = getStoredToken();
  const baseUrl = requireDirectusUrl().replace(/\/$/, "");
  const url = `${baseUrl}/assets/${fileId}`;
  return token ? `${url}?access_token=${token}` : url;
};

export const listRoles = async () => {
  const data = await directusRequest("/roles?fields=id,name&limit=100");
  return data?.data ?? [];
};

export const getUserByEmail = async (email: string) => {
  const data = await directusRequest(
    `/users?filter[email][_eq]=${encodeURIComponent(email)}&fields=id,email,first_name,last_name,role`,
  );
  const users = data?.data ?? [];
  return users.length > 0 ? (users[0] as DirectusUser) : null;
};

export const createUser = async (payload: {
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  status?: string;
  password?: string;
  password_change_required?: boolean;
  description?: string;
  title?: string;
  location?: string;
  facility?: string;
}) => {
  const data = await directusRequest("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data?.data;
};

export const inviteUser = async (
  email: string,
  roleId: string,
  inviteUrl: string,
) => {
  const data = await directusRequest("/users/invite", {
    method: "POST",
    body: JSON.stringify({ email, role: roleId, invite_url: inviteUrl }),
  });
  return data;
};

export const requestPasswordReset = async (email: string, resetUrl: string) => {
  const baseUrl = requireDirectusUrl().replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/auth/password/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, reset_url: resetUrl }),
  });

  if (!response.ok) {
    const data = await safeJson(response);
    throw new Error(
      data?.errors?.[0]?.message ?? "Password reset request failed",
    );
  }

  return true;
};

const publicBackendRequest = async (
  path: string,
  options: RequestInit = {},
) => {
  const baseUrl = requireDirectusUrl().replace(/\/$/, "");

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
};

export const acceptUserInvite = async (token: string, password: string) => {
  await publicBackendRequest("/directus/users/invite/accept", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
};

export const updateUser = async (
  id: string,
  payload: Partial<{
    email: string;
    first_name?: string;
    last_name?: string;
    role?: string;
    status?: string;
    password?: string;
    password_change_required?: boolean;
    description?: string;
    title?: string;
    location?: string;
    facility?: string;
  }>,
) => {
  const data = await directusRequest(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return data?.data;
};

export const updateCurrentUserPassword = async (password: string) => {
  const data = await directusRequest("/users/me", {
    method: "PATCH",
    body: JSON.stringify({
      password,
      password_change_required: false,
    }),
  });
  return data?.data;
};

// Sentinel error so the UI can show a friendly message when a hard delete
// is blocked by linked records (notifications, flagged forms, etc).
export class UserHasLinkedRecordsError extends Error {
  underlying?: string;
  constructor(underlying?: string) {
    super(
      underlying
        ? `Permanent delete blocked by a residual database reference: ${underlying}`
        : "This user is still referenced somewhere in the system and cannot be permanently deleted. The user remains archived.",
    );
    this.name = "UserHasLinkedRecordsError";
    this.underlying = underlying;
  }
}

const isForeignKeyError = (msg: string) => {
  const m = msg.toLowerCase();
  return (
    m.includes("foreign key") ||
    m.includes("sqlite_constraint") ||
    m.includes("violates foreign key") ||
    m.includes("update or delete on table")
  );
};

// Clean up rows in custom collections that FK-reference the user.
// Uses the standard /items/{collection} API — no system-table hacks.
const scrubUserReferences = async (
  userId: string,
  collection: string,
  fields: string[],
) => {
  for (const field of fields) {
    try {
      const data = await directusRequest(
        `/items/${collection}?filter[${field}][_eq]=${encodeURIComponent(userId)}&fields=id&limit=200`,
      );
      const items: Array<{ id: string }> = Array.isArray(data?.data)
        ? data.data
        : [];
      for (const it of items) {
        try {
          await directusRequest(`/items/${collection}/${it.id}`, {
            method: "DELETE",
          });
        } catch {
          try {
            await directusRequest(`/items/${collection}/${it.id}`, {
              method: "PATCH",
              body: JSON.stringify({ [field]: null }),
            });
          } catch {
            /* skip */
          }
        }
      }
    } catch {
      /* skip */
    }
  }
};

const purgeUserNotifications = async (userId: string) => {
  for (const field of ["recipient", "sender"] as const) {
    try {
      const data = await directusRequest(
        `/notifications?filter[${field}][_eq]=${encodeURIComponent(userId)}&fields=id&limit=200`,
      );
      const items: Array<{ id: number | string }> = data?.data ?? [];
      for (const n of items) {
        try {
          await directusRequest(`/notifications/${n.id}`, { method: "DELETE" });
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }
};

export const deleteUser = async (id: string) => {
  // Some users have no references — try a straight delete first.
  try {
    await directusRequest(`/users/${id}`, { method: "DELETE" });
    return;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!isForeignKeyError(msg)) throw err;
  }

  // FK blocked — clean up custom table references then retry.
  await purgeUserNotifications(id);
  await scrubUserReferences(id, "flagged_forms_ecapplus_pmp", [
    "user_created",
    "created_by",
    "flagged_by",
    "caseworker",
  ]);
  await scrubUserReferences(id, "flagged_forms_ecapii", [
    "user_created",
    "created_by",
    "flagged_by",
    "caseworker",
  ]);
  await scrubUserReferences(id, "calendar_events", [
    "user_id",
    "user_created",
    "created_by",
  ]);

  try {
    await directusRequest(`/users/${id}`, { method: "DELETE" });
    return;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!isForeignKeyError(msg)) throw err;
    try {
      await directusRequest(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "suspended" }),
      });
    } catch {
      /* ignore */
    }
    throw new UserHasLinkedRecordsError(msg);
  }
};

export type Notification = {
  id: string;
  status: string;
  timestamp: string;
  sender: string | null;
  recipient: string;
  subject: string;
  message: string;
  collection: string | null;
  item: string | null;
};

export const getNotifications = async (userId?: string) => {
  if (!userId) {
    // SECURITY: Return empty if no userId is provided to prevent accidental data leakage
    return [];
  }
  const params = new URLSearchParams({
    "filter[status][_eq]": "inbox",
    "filter[recipient][_eq]": userId, // SECURITY: Strictly filter by recipient
    sort: "-timestamp",
    limit: "100",
    fields: "id,subject,message,timestamp,collection,sender,recipient,item",
  });

  const data = await directusRequest(`/notifications?${params.toString()}`);
  return (data?.data ?? []).filter((n: any) => n.recipient === userId); // Secondary check
};

export const markNotificationRead = async (id: string) => {
  const data = await directusRequest(
    `/notifications/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "archived" }),
    },
  );
  return data?.data;
};

export const createNotification = async (payload: {
  recipient: string;
  sender?: string; // Added sender field
  subject: string;
  message?: string;
  collection?: string;
  item?: string;
}) => {
  const data = await directusRequest("/notifications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data?.data;
};

/**
 * Sends an email via the Directus /mail endpoint.
 */
export const sendMail = async (payload: {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}) => {
  const data = await directusRequest("/mail", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data;
};

/**
 * Batch-archive every inbox notification for a user with a single Directus
 * PATCH. Avoids the N+1 race where new notifications arriving mid-clear
 * survived the loop, and removes the prior 20-item pagination cap.
 */
export const clearAllNotifications = async (userId: string) => {
  if (!userId) return 0;
  const params = new URLSearchParams({
    "filter[recipient][_eq]": userId,
    "filter[status][_eq]": "inbox",
  });
  const data = await directusRequest(`/notifications?${params.toString()}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "archived" }),
  });
  return Array.isArray(data?.data) ? data.data.length : 0;
};

/**
 * Batch-mark every inbox notification for a user as read (status: archived
 * in this app's semantics is used for dismissal; "read" maps to archived
 * for the dashboard bell badge).
 */
export const markAllNotificationsReadForUser = clearAllNotifications;

/**
 * Manually triggers the Weekly Extract Notifications flow on the server.
 * This flow sends in-app notifications and emails to the full distribution list.
 * We trigger it by creating a record in the 'weekly_extracts' collection.
 */
export const triggerWeeklyFlow = async () => {
  try {
    // We create a minimal record to trigger the Flow
    // Using an empty object to avoid "field not found" errors if triggered_at doesn't exist
    await directusRequest("/items/weekly_extracts", {
      method: "POST",
      body: JSON.stringify({}),
    });

    return {
      sent: "Queued",
      emailsSent: "Queued",
      matched: "Server-side",
      subject: "Weekly Extracts",
    };
  } catch (error) {
    console.error("Error triggering weekly flow:", error);
    throw error;
  }
};

export const notifyAllUsers = async (subject: string, message: string) => {
  const users = await listUsers("active");
  const notificationResults = await Promise.allSettled(
    users.map((u: DirectusUser) =>
      createNotification({
        recipient: u.id,
        subject,
        message,
        collection: "weekly_extracts",
      }),
    ),
  );

  // Send emails to all active users (best effort, requires /mail permissions)
  const emailResults = await Promise.allSettled(
    users.map(async (u: DirectusUser) => {
      try {
        return await sendMail({
          to: u.email,
          subject,
          text: message,
        });
      } catch (e: any) {
        console.warn(`Failed to send email to ${u.email}:`, e.message);
        throw e;
      }
    }),
  );

  const sent = notificationResults.filter(
    (r) => r.status === "fulfilled",
  ).length;
  const emailsSent = emailResults.filter(
    (r) => r.status === "fulfilled",
  ).length;

  return { sent, emailsSent, total: users.length };
};

// Roles that should be notified when a record is flagged / a flag is
// resolved. Anything else (caseworkers, viewers) gets filtered out so we
// stop blasting a notification to every active user in the system.
const FLAG_NOTIFY_ROLE_KEYWORDS = [
  "admin",
  "administrator",
  "supervisor",
  "qa",
  "data quality",
  "manager",
];

const isFlagNotifyRecipient = (u: DirectusUser) => {
  const roleName =
    typeof u.role === "object" && u.role !== null
      ? String((u.role as { name?: string }).name ?? "")
      : "";
  if (!roleName) return false;
  const lower = roleName.toLowerCase();
  return FLAG_NOTIFY_ROLE_KEYWORDS.some((k) => lower.includes(k));
};

export const notifyUsersOfFlag = async (
  hhId: string,
  verifier: string,
  comment: string,
  vcaId?: string,
) => {
  const users = (await listUsers("active")) as DirectusUser[];
  const recipients = users.filter(isFlagNotifyRecipient);
  const entityId =
    vcaId && vcaId !== "Not Available"
      ? `VCA ${vcaId} (HH ${hhId})`
      : `Household ${hhId}`;
  const subject = `Record Flagged: ${entityId}`;
  const message = `A record for ${entityId} has been flagged by ${verifier}. \n\nComment: ${comment}`;

  return Promise.allSettled(
    recipients.map((u) =>
      createNotification({
        recipient: u.id,
        subject,
        message,
        collection: "flagged_forms_ecapplus_pmp",
      }),
    ),
  );
};

export const notifyUsersOfFlagResolution = async (
  hhId: string,
  resolver: string,
  comment: string,
  vcaId?: string,
) => {
  const users = (await listUsers("active")) as DirectusUser[];
  const recipients = users.filter(isFlagNotifyRecipient);
  const entityId =
    vcaId && vcaId !== "Not Available"
      ? `VCA ${vcaId} (HH ${hhId})`
      : `Household ${hhId}`;
  const subject = `Flag Resolved: ${entityId}`;
  const message = `The flag for ${entityId} has been resolved by ${resolver}. \n\nResolution/Comment: ${comment}`;

  return Promise.allSettled(
    recipients.map((u) =>
      createNotification({
        recipient: u.id,
        subject,
        message,
        collection: "flagged_forms_ecapplus_pmp",
      }),
    ),
  );
};

export type CalendarEvent = {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  category: "Meeting" | "Field Visit" | "Deadline" | "Personal";
  user_id: string;
  status: "scheduled" | "cancelled" | "completed";
};

export const getCalendarEvents = async (userId: string) => {
  const params = new URLSearchParams({
    "filter[user_id][_eq]": userId,
    fields: "id,title,description,start_time,end_time,category,user_id,status",
    sort: "start_time",
  });
  const data = await directusRequest(
    `/items/calendar_events?${params.toString()}`,
  );
  return data?.data ?? [];
};

export const createCalendarEvent = async (payload: Partial<CalendarEvent>) => {
  const data = await directusRequest("/items/calendar_events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data?.data;
};

export const updateCalendarEvent = async (
  id: string,
  payload: Partial<CalendarEvent>,
) => {
  const data = await directusRequest(`/items/calendar_events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return data?.data;
};

export const deleteCalendarEvent = async (id: string) => {
  await directusRequest(`/items/calendar_events/${id}`, {
    method: "DELETE",
  });
};

export type DirectusActivityEntry = {
  id: number;
  action: string;
  collection: string;
  timestamp: string;
  user?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    // Schema truth (directus_users): title = province, location = district,
    // district/facility are dedicated text fields that can hold CSV lists.
    district?: string;
    facility?: string;
    location?: string;
    title?: string;
    description?: string;
  } | null;
};

// Collections whose activity must not appear on the PMP User Activity tab.
const ACTIVITY_EXCLUDED_COLLECTIONS = [
  "case_management",
  "finance",
  "stores",
  "human_resource",
  "procurement",
];

export const listUserActivity = async (
  limit = 500,
): Promise<DirectusActivityEntry[]> => {
  const roleId = import.meta.env.VITE_DIRECTUS_USER_ROLE;
  if (!roleId || roleId.includes("<")) {
    throw new Error("VITE_DIRECTUS_USER_ROLE is not configured");
  }
  const params = new URLSearchParams({
    fields:
      "id,action,collection,timestamp,user.id,user.first_name,user.last_name,user.email,user.district,user.facility,user.location,user.title,user.description",
    sort: "-timestamp",
    limit: String(limit),
  });
  params.set("filter[user][role][_eq]", roleId);
  params.set(
    "filter[collection][_nin]",
    ACTIVITY_EXCLUDED_COLLECTIONS.join(","),
  );
  const data = await directusRequest(`/activity?${params.toString()}`);
  return data?.data ?? [];
};

export type PmpUser = {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  // title = province level, location = legacy district, district/facility can
  // hold CSV lists, description = user level ("Facility User", ...).
  title?: string;
  location?: string;
  district?: string;
  facility?: string;
  description?: string;
  last_access?: string | null;
  status?: string;
};

export const listPmpUsers = async (): Promise<PmpUser[]> => {
  const roleId = import.meta.env.VITE_DIRECTUS_USER_ROLE;
  if (!roleId || roleId.includes("<")) {
    throw new Error("VITE_DIRECTUS_USER_ROLE is not configured");
  }
  const params = new URLSearchParams({
    fields:
      "id,first_name,last_name,email,title,location,district,facility,description,last_access,status",
    sort: "first_name",
    limit: "500",
  });
  params.set("filter[role][_eq]", roleId);
  const data = await directusRequest(`/users?${params.toString()}`);
  return data?.data ?? [];
};

// Deliver an announcement to each recipient's notification bell.
export const broadcastAnnouncement = async (
  recipientIds: string[],
  subject: string,
  message: string,
) => {
  const results = await Promise.allSettled(
    recipientIds.map((recipient) =>
      createNotification({ recipient, subject, message }),
    ),
  );
  const sent = results.filter((r) => r.status === "fulfilled").length;
  return { sent, failed: results.length - sent };
};

// Facility users are not referenced by id on flagged forms — the link is the
// flag's facility name. Fetch just enough to count flags per facility.
export type FlaggedFormFacilityRef = { id: string; facility?: string | null };

export const listFlaggedFormFacilities = async (): Promise<
  FlaggedFormFacilityRef[]
> => {
  const params = new URLSearchParams({ fields: "id,facility", limit: "1000" });
  const data = await directusRequest(
    `/items/flagged_forms_ecapii?${params.toString()}`,
  );
  return data?.data ?? [];
};
