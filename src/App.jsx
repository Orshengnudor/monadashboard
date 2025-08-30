import { useState, useEffect } from "react"; 
import { ethers } from "ethers";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import "./App.css";
import gameData from "./gameData";

// ERC-20 ABI minimal to get balance and decimals
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

// Backend API URL (updated to deployed server)
const API_URL = "https://monad-leaderboard-server.vercel.app/api";

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
  const [leaderboard, setLeaderboard] = useState([]); // Store leaderboard data

  const ALCHEMY_API_URL = "https://monad-testnet.g.alchemy.com/v2/t8TcyfIGJYS3otYySM2t6";

  // Persistent custom tokens
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
    const defaultKeys = new Set(["DAK", "CHOG", "YAKI", "CULT", "GMONAD", "aprMON", "shMON", "sMON"]);
    const customOnly = Object.fromEntries(
      Object.entries(TOKENS).filter(([k]) => !defaultKeys.has(k))
    );
    localStorage.setItem("monad_custom_tokens", JSON.stringify(customOnly));
  }, [TOKENS]);

  // Fetch leaderboard on mount and refresh
  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const shortenAddress = (addr) =>
    addr && addr !== "Not connected"
      ? `${addr.slice(0, 6)}...${addr.slice(-4)}`
      : addr;

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

  const disconnectWallet = () => {
    setWalletAddress("Not connected");
    setBalances({ MON: 0, DAK: 0, CHOG: 0, YAKI: 0 });
    setTotalTx(0);
    setNftCount(0);
  };

  const fetchBalances = async (address) => {
    try {
      const provider = new ethers.JsonRpcProvider(ALCHEMY_API_URL); // Reverted to old behavior
      const rawBalance = await provider.getBalance(address);
      const monBalance = parseFloat(ethers.formatEther(rawBalance));

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

  const fetchTotalTransactions = async (address) => {
    setLoadingTx(true);
    try {
      const provider = new ethers.JsonRpcProvider(ALCHEMY_API_URL);
      const txCount = await provider.getTransactionCount(address);
      setTotalTx(txCount);
    } catch {
      setTotalTx(0);
    }
    setLoadingTx(false);
  };

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
    } catch {
      setNftCount(0);
    }
    setLoadingNFTs(false);
  };

  // Fetch leaderboard from backend with percentage calculation
  const fetchLeaderboard = async () => {
    try {
      const response = await axios.get(`${API_URL}/leaderboard`);
      const data = response.data;
      const totalScore = data.reduce((sum, entry) => sum + entry.score, 0);
      const leaderboardData = data.map(entry => ({
        wallet: entry.wallet,
        score: entry.score,
        percentage: totalScore > 0 ? ((entry.score / totalScore) * 100).toFixed(2) + "%" : "0%"
      }));
      setLeaderboard(leaderboardData.sort((a, b) => b.score - a.score));
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
      setLeaderboard([]);
    }
  };

  const tokenData = Object.entries(balances).map(([name, value]) => ({ name, value }));
  const COLORS = ["#8b5cf6", "#f97316", "#10b981", "#ef4444", "#6366f1", "#14b8a6", "#f43f5e", "#eab308"];

  const renderLegendBelow = () => {
    const total = tokenData.reduce((acc, item) => acc + item.value, 0);
    return (
      <div style={{ marginTop: 16, textAlign: "center", maxHeight: 200, overflowY: "auto", width: "100%" }}>
        {tokenData.map((entry, index) => {
          const percent = total > 0 ? ((entry.value / total) * 100).toFixed(2) : "0.00";
          return (
            <div key={index} style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 6 }}>
              <div style={{ width: 14, height: 14, backgroundColor: COLORS[index % COLORS.length], marginRight: 8 }}></div>
              <span>{`${Number(entry.value || 0).toFixed(5)} ${entry.name} (${percent}%)`}</span>
            </div>
          );
        })}
      </div>
    );
  };

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

  // Save score to backend
  const saveScore = async () => {
    if (walletAddress === "Not connected") {
      return alert("Please connect your wallet to save your score!");
    }
    try {
      await axios.post(`${API_URL}/leaderboard`, {
        wallet: walletAddress,
        score,
        timestamp: Date.now()
      });
      alert("Score saved to leaderboard!");
      fetchLeaderboard(); // Refresh leaderboard
    } catch (err) {
      console.error("Failed to save score:", err);
      alert("Failed to save score to leaderboard. See console for details.");
    }
  };

  const pageStyle = { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", background: "#130629", color: "#ffffff", padding: "24px" };
  const stackStyle = { width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 };
  const cardStyle = { background: "#ffffff", color: "#000000", borderRadius: 16, boxShadow: "0 10px 24px rgba(0,0,0,0.25)", padding: 24, width: "100%", textAlign: "center" };
  const buttonPrimary = { background: "#7c3aed", color: "#ffffff", padding: "10px 16px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 600 };
  const buttonSecondary = { background: "#16a34a", color: "#ffffff", padding: "10px 16px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 600 };
  const buttonBreak = { background: "#ef4444", color: "#ffffff", padding: "10px 16px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 600 };
  const buttonRow = { display: "flex", gap: 16, justifyContent: "center", width: "100%", marginTop: 16 };
  const inputStyle = { border: "1px solid #ccc", borderRadius: 8, padding: "8px 10px", width: "100%", marginBottom: 8 };
  const chartCardStyle = { ...cardStyle, maxWidth: 560, display: "flex", flexDirection: "column", alignItems: "center" };

  const [quizIndex, setQuizIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [gameActive, setGameActive] = useState(false);

  const current = gameData[quizIndex];

  useEffect(() => {
    if (!gameActive) return;
    if (timeLeft <= 0) {
      handleAnswer(null);
      return;
    }
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, gameActive]);

  const startGame = () => {
    setScore(0);
    setWrong(0);
    setQuizIndex(0);
    setSelected(null);
    setTimeLeft(15);
    setGameActive(true);
  };

  const quitGame = () => {
    setGameActive(false);
    setQuizIndex(0);
    setSelected(null);
    setTimeLeft(15);
  };

  const handleAnswer = (opt) => {
    if (!gameActive) return;
    if (opt === current.answer) {
      setScore((s) => s + 1);
    } else if (opt !== null) {
      setWrong((w) => w + 1);
    }
    setTimeout(() => {
      if (quizIndex + 1 < gameData.length) {
        setQuizIndex((i) => i + 1);
        setSelected(null);
        setTimeLeft(15);
      } else {
        alert(`Game over! Score: ${score + (opt === current?.answer ? 1 : 0)} / ${gameData.length}`);
        setGameActive(false);
      }
    }, 500);
  };

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 24, textAlign: "center" }}>Monad Dashboard x Game</h1>
      <div style={stackStyle}>
        <div style={buttonRow}>
          {walletAddress === "Not connected" ? (
            <button onClick={connectWallet} style={buttonPrimary}>Connect Wallet</button>
          ) : (
            <button onClick={disconnectWallet} style={buttonPrimary}>Disconnect Wallet</button>
          )}
          <button onClick={() => walletAddress !== "Not connected" && (fetchBalances(walletAddress), fetchTotalTransactions(walletAddress), fetchAllNFTs(walletAddress))} style={buttonSecondary}>Refresh</button>
          <button onClick={() => window.open("https://monad-leaderboard-theta.vercel.app/", "_blank")} style={buttonBreak}>Break Monad</button>
        </div>

        <div style={cardStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>What is the Name of the dApp?</h2>
          {!gameActive ? (
            <button onClick={startGame} style={buttonPrimary}>Start Game</button>
          ) : (
            <>
              <img src={current.logo} alt="Logo" style={{ width: 100, height: 100, objectFit: "contain", marginBottom: 12 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {current.options.map((opt) => (
                  <button key={opt} onClick={() => handleAnswer(opt)} disabled={!!selected} style={{ ...buttonSecondary, background: selected && opt === current.answer ? "#16a34a" : selected && opt === selected ? "#ef4444" : "#16a34a" }}>
                    {opt}
                  </button>
                ))}
              </div>
              <p style={{ marginTop: 12 }}>⏳ Time Left: {timeLeft}s</p>
              <p>✅ Score: {score} | ❌ Wrong: {wrong}</p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 12 }}>
                <button onClick={startGame} style={buttonPrimary}>Restart Game</button>
                <button onClick={quitGame} style={buttonBreak}>Quit</button>
                <button onClick={saveScore} style={buttonSecondary}>Save Score</button>
              </div>
            </>
          )}
        </div>

        <div style={cardStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Wallet Address</h2>
          <p>{shortenAddress(walletAddress)}</p>
        </div>

        <div style={cardStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Balance</h2>
          <p style={{ fontSize: 24, fontWeight: 800 }}>{Number(balances.MON || 0).toFixed(5)} MON</p>
        </div>

        <div style={cardStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Total Transactions</h2>
          <p style={{ fontSize: 24, fontWeight: 800 }}>{loadingTx ? "Loading..." : totalTx}</p>
        </div>

        <div style={cardStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>NFTs Owned</h2>
          <p style={{ fontSize: 24, fontWeight: 800 }}>{loadingNFTs ? "Loading..." : nftCount}</p>
        </div>

        <div style={cardStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Add token CA</h2>
          <input value={customTokenCA} onChange={(e) => setCustomTokenCA(e.target.value)} placeholder="0x..." style={inputStyle} />
          <button onClick={addToken} style={buttonPrimary}>Add Token</button>
        </div>

        <div style={chartCardStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Token Distribution</h2>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={tokenData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
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

        <div style={cardStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Leaderboard</h2>
          {leaderboard.length === 0 ? (
            <p>No scores yet. Play and save your score!</p>
          ) : (
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {leaderboard.map((entry, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <span>{idx + 1}. {shortenAddress(entry.wallet)}</span>
                  <span>Score: {entry.score}</span>
                  <span>{entry.percentage}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}