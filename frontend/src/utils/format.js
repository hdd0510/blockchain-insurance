import { ethers } from "ethers";

// Convert wei to ETH string with 4 decimal places
export const weiToEth = (wei) =>
  parseFloat(ethers.formatEther(wei.toString())).toFixed(4);

// Convert ETH to wei string
export const ethToWei = (eth) =>
  ethers.parseEther(eth.toString()).toString();

// Shorten wallet address: 0x1234...abcd
export const shortAddr = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

// Format unix timestamp to Vietnamese locale date
export const formatDate = (ts) =>
  new Date(Number(ts) * 1000).toLocaleDateString("vi-VN");

// Map numeric claim status to Vietnamese label
export const claimStatusLabel = (s) =>
  ["Chờ xử lý", "Đang xem xét", "Cần bổ sung", "Đã duyệt", "Từ chối", "Đã thanh toán"][s] || String(s);

// Map string policy status to Vietnamese label
export const policyStatusLabel = (s) =>
  ({ active: "Còn hiệu lực", expired: "Hết hạn", cancelled: "Đã hủy" }[s] || s);
