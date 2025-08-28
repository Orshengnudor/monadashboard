import { useState, useEffect } from "react";
import { ethers } from "ethers";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import "./App.css";

// ERC-20 ABI minimal to get balance and decimals
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

export default function App() {
  const [walletAddress, setWalletAddress] = useState("Not connected");
  const [balances, setBalances] = useState({ MON: 0, DAK: 0, CHOG: 0, YAKI: 0 });
  const [totalTx, setTotalTx] = useState(0);
  const [loadingTx, setLoadingTx] = useState(false);
  const [nftCount, setNftCount] = useState(0);
  const [loadingNFTs, setLoadingNFTs] = useState(false);
  const [customTokenCA, setCustomTokenCA] = useState("");
  const [TOKENS, setTOKENS] = useState({
    DAK: "0x0F0BDEbF0F83cD1EE3974779Bcb7315f9808c714",
    CHOG: "0xE0590015A873bF326bd645c3E1266d4db41C4E6B",
    YAKI: "0xfe140e1dCe99Be9F4F15d657CD9b7BF622270C50",
    CULT: "0xAbF39775d23c5B6C0782f3e35B51288bdaf946e2",
    GMONAD: "0x93C33B999230eE117863a82889Fdb342cd6D5C64",
    aprMON: "0xb2f82D0f38dc453D596Ad40A37799446Cc89274A",
    shMON: "0x1b4Cb47622705F0F67b6B18bBD1cB1a91fc77d37",
    sMON: "0xe1d2439b75fb9746E7Bc6cB777Ae10AA7f7ef9c5"
  });

  // --- Persistent custom tokens (survive refresh/disconnect) ---
  useEffect(() => {
    const saved = localStorage.getItem("monad_custom_tokens");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          setTOKENS((prev) => ({ ...prev, ...parsed }));
        }
      } catch {}
    }
  }, []);
  useEffect(() => {
    const defaultKeys = new Set([
      "DAK","CHOG","YAKI","CULT","GMONAD","aprMON","shMON","sMON"
    ]);
    const customOnly = Object.fromEntries(
      Object.entries(TOKENS).filter(([k]) => !defaultKeys.has(k))
    );
    localStorage.setItem("monad_custom_tokens", JSON.stringify(customOnly));
  }, [TOKENS]);

  const shortenAddress = (addr) =>
    addr && addr !== "Not connected"
      ? `${addr.slice(0, 6)}...${addr.slice(-4)}`
      : addr;

  const ALCHEMY_API_URL = "https://monad-testnet.g.alchemy.com/v2/t8TcyfIGJYS3otYySM2t6";

  // Connect wallet
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        setWalletAddress(accounts[0]);
        fetchBalances(accounts[0]);
        fetchTotalTransactions(accounts[0]);
        fetchAllNFTs(accounts[0]);
      } catch (err) {
        console.error("Wallet connection failed:", err);
      }
    } else {
      alert("Please install MetaMask to connect your wallet.");
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setWalletAddress("Not connected");
    setBalances({ MON: 0, DAK: 0, CHOG: 0, YAKI: 0 });
    setTotalTx(0);
    setNftCount(0);
  };

  // Fetch balances
  const fetchBalances = async (address) => {
    try {
      const provider = new ethers.JsonRpcProvider(ALCHEMY_API_URL);

      // Native MON
      const rawBalance = await provider.getBalance(address);
      const monBalance = parseFloat(ethers.formatEther(rawBalance));

      // ERC-20 tokens
      const tokenBalances = {};
      for (let [symbol, ca] of Object.entries(TOKENS)) {
        const contract = new ethers.Contract(ca, ERC20_ABI, provider);
        const [balance, decimals] = await Promise.all([
          contract.balanceOf(address),
          contract.decimals()
        ]);
        tokenBalances[symbol] = parseFloat(
          parseFloat(ethers.formatUnits(balance, decimals)).toFixed(5)
        );
      }

      setBalances({ MON: parseFloat(monBalance.toFixed(5)), ...tokenBalances });
    } catch (err) {
      console.error("Balance fetch failed:", err);
      setBalances({ MON: 0, DAK: 0, CHOG: 0, YAKI: 0 });
    }
  };

  // Fetch total transactions
  const fetchTotalTransactions = async (address) => {
    setLoadingTx(true);
    try {
      const provider = new ethers.JsonRpcProvider(ALCHEMY_API_URL);
      const txCount = await provider.getTransactionCount(address);
      setTotalTx(txCount);
    } catch (err) {
      console.error("Transaction count fetch failed:", err);
      setTotalTx(0);
    }
    setLoadingTx(false);
  };

  // Fetch NFTs
  const fetchAllNFTs = async (address) => {
    setLoadingNFTs(true);
    try {
      let allNFTs = [];
      let pageKey = null;
      do {
        const response = await axios.get(`${ALCHEMY_API_URL}/getNFTs/`, {
          params: { owner: address, pageKey: pageKey || undefined }
        });
        const ownedNFTs = response.data.ownedNfts || [];
        allNFTs = allNFTs.concat(ownedNFTs);
        pageKey = response.data.pageKey || null;
      } while (pageKey);
      setNftCount(allNFTs.length);
    } catch (err) {
      console.error("NFT fetch failed:", err);
      setNftCount(0);
    }
    setLoadingNFTs(false);
  };

  // Pie chart data
  const tokenData = Object.entries(balances).map(([name, value]) => ({ name, value }));
  const COLORS = ["#8b5cf6", "#f97316", "#10b981", "#ef4444", "#6366f1", "#14b8a6", "#f43f5e", "#eab308"];

  // Legend below chart
  const renderLegendBelow = () => {
    const total = tokenData.reduce((acc, item) => acc + item.value, 0);
    return (
      <div
        style={{
          marginTop: 16,
          textAlign: "center",
          maxHeight: 200,
          overflowY: "auto",
          width: "100%"
        }}
      >
        {tokenData.map((entry, index) => {
          const percent = total > 0 ? ((entry.value / total) * 100).toFixed(2) : "0.00";
          return (
            <div
              key={index}
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 6
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  backgroundColor: COLORS[index % COLORS.length],
                  marginRight: 8
                }}
              ></div>
              <span>{`${Number(entry.value || 0).toFixed(5)} ${entry.name} (${percent}%)`}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Add custom token
  const addToken = () => {
    if (!customTokenCA) return;
    const symbol = prompt("Enter token symbol:");
    if (!symbol) return;
    setTOKENS((prev) => ({ ...prev, [symbol]: customTokenCA }));
    setCustomTokenCA("");
    if (walletAddress && walletAddress !== "Not connected") {
      fetchBalances(walletAddress);
    }
  };

  // ------- Styles -------
  const pageStyle = {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    background: "#130629",
    color: "#ffffff",
    padding: "24px"
  };

  const stackStyle = {
    width: "100%",
    maxWidth: 560,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 24
  };

  const cardStyle = {
    background: "#ffffff",
    color: "#000000",
    borderRadius: 16,
    boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
    padding: 24,
    width: "100%",
    textAlign: "center"
  };

  const buttonPrimary = {
    background: "#7c3aed",
    color: "#ffffff",
    padding: "10px 16px",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    fontWeight: 600
  };

  const buttonSecondary = {
    background: "#16a34a",
    color: "#ffffff",
    padding: "10px 16px",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    fontWeight: 600
  };

  const buttonBreak = {
    background: "#ef4444", // red for Break Monad
    color: "#ffffff",
    padding: "10px 16px",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    fontWeight: 600
  };

  const buttonRow = {
    display: "flex",
    gap: 16,
    justifyContent: "center",
    width: "100%",
    marginTop: 16
  };

  const inputStyle = {
    border: "1px solid #ccc",
    borderRadius: 8,
    padding: "8px 10px",
    width: "100%",
    marginBottom: 8
  };

  const chartCardStyle = {
    ...cardStyle,
    maxWidth: 560,
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  };

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 24, textAlign: "center" }}>
        Monad Dashboard
      </h1>

      <div style={stackStyle}>
        {/* Wallet Address */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Wallet Address</h2>
          <p style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {shortenAddress(walletAddress)}
          </p>
        </div>

        {/* Balance */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Balance</h2>
          <p style={{ fontSize: 24, fontWeight: 800 }}>
            {Number(balances.MON || 0).toFixed(5)} MON
          </p>
        </div>

        {/* Total Transactions */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Total Transactions</h2>
          <p style={{ fontSize: 24, fontWeight: 800 }}>
            {loadingTx ? "Loading..." : totalTx}
          </p>
        </div>

        {/* NFTs Owned */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>NFTs Owned</h2>
          <p style={{ fontSize: 24, fontWeight: 800 }}>
            {loadingNFTs ? "Loading..." : nftCount}
          </p>
        </div>

        {/* Add Token */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Add token CA</h2>
          <input
            value={customTokenCA}
            onChange={(e) => setCustomTokenCA(e.target.value)}
            placeholder="0x..."
            style={inputStyle}
          />
          <button onClick={addToken} style={buttonPrimary}>Add Token</button>
        </div>

        {/* Token Distribution Chart */}
        <div style={chartCardStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Token Distribution</h2>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tokenData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  label
                >
                  {tokenData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {renderLegendBelow()}
        </div>

        {/* Buttons */}
        <div style={buttonRow}>
          {walletAddress === "Not connected" ? (
            <button onClick={connectWallet} style={buttonPrimary}>
              Connect Wallet
            </button>
          ) : (
            <button onClick={disconnectWallet} style={buttonPrimary}>
              Disconnect Wallet
            </button>
          )}
          <button
            onClick={() => {
              if (walletAddress !== "Not connected") {
                fetchBalances(walletAddress);
                fetchTotalTransactions(walletAddress);
                fetchAllNFTs(walletAddress);
              }
            }}
            style={buttonSecondary}
          >
            Refresh
          </button>
          <button
            onClick={() => window.open("https://monad-leaderboard-theta.vercel.app/", "_blank")}
            style={buttonBreak}
          >
            Break Monad
          </button>
        </div>
      </div>
    </div>
  );
}
