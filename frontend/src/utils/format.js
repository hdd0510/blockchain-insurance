import { ethers } from "ethers";

export const weiToEth = (wei) =>
  parseFloat(ethers.formatEther(wei.toString())).toFixed(4);

export const ethToWei = (eth) =>
  ethers.parseEther(eth.toString()).toString();

export const shortAddr = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

export const formatDate = (ts) =>
  new Date(Number(ts) * 1000).toLocaleDateString("vi-VN");

// v2: mirror of ClaimsProcessor.ClaimStatus enum (12 entries).
export const CLAIM_STATUS_KEYS = [
  "pending",
  "under_review",
  "oracle_verified",
  "needs_info",
  "approved",
  "paid",
  "rejected",
  "appealed",
  "appeal_reviewing",
  "appeal_accepted",
  "appeal_rejected",
  "expired",
];

export const CLAIM_STATUS_LABELS = {
  pending: "Chờ xử lý",
  under_review: "Đang xem xét",
  oracle_verified: "Oracle xác minh OK",
  needs_info: "Cần bổ sung",
  approved: "Đã duyệt",
  paid: "Đã thanh toán",
  rejected: "Từ chối",
  appealed: "Đang kháng cáo",
  appeal_reviewing: "Đang xét kháng cáo",
  appeal_accepted: "Chấp nhận kháng cáo",
  appeal_rejected: "Bác kháng cáo",
  expired: "Hết hạn xử lý",
};

export const claimStatusLabel = (s) => {
  if (typeof s === "number") return CLAIM_STATUS_LABELS[CLAIM_STATUS_KEYS[s]] || String(s);
  return CLAIM_STATUS_LABELS[s] || s;
};

export const policyStatusLabel = (s) =>
  ({ active: "Còn hiệu lực", expired: "Hết hạn", cancelled: "Đã hủy" }[s] || s);

export const appealStatusLabel = (s) =>
  ({
    filed: "Đã nộp",
    reviewing: "Đang xét",
    accepted: "Chấp nhận",
    rejected: "Bác bỏ",
  }[s] || s);

export const hospitalVerificationLabel = (s) =>
  ({
    pending: "Đang chờ",
    verified: "Đã xác minh",
    not_verified: "Không khớp",
    error: "Lỗi",
  }[s] || s);
