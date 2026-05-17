// Show shortened transaction hash with optional Etherscan link
const NETWORK_ID = process.env.REACT_APP_NETWORK_ID;

function getExplorerUrl(hash) {
  if (NETWORK_ID === "11155111") {
    return `https://sepolia.etherscan.io/tx/${hash}`;
  }
  // Local Hardhat network — no explorer
  return null;
}

export default function TxHash({ hash }) {
  if (!hash) return null;
  const short = `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  const url = getExplorerUrl(hash);

  return (
    <span className="font-mono text-xs text-gray-600">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
          {short}
        </a>
      ) : (
        <span title={hash}>{short}</span>
      )}
    </span>
  );
}
