import api from "./api";

export async function listAuditLogs(filters = {}) {
  const { data } = await api.get("/audit-logs", { params: filters });
  return data;
}

export async function listAuditForEntity(type, id) {
  const { data } = await api.get(`/audit-logs/entity/${type}/${id}`);
  return data;
}
