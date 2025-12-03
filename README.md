# Crypto Trading Bot for Binance.US

An autonomous cryptocurrency trading bot designed to manage your Binance.US account profitably using proven trading strategies with a moderate-risk profile.

## 🚀 Features

- **Multiple Trading Strategies**: RSI, MACD, EMA Crossover, or Combined strategy
- **Risk Management**: Stop-loss, take-profit, trailing stop, and position sizing
- **Paper Trading**: Test strategies without risking real money
- **Web Dashboard**: Real-time monitoring and control
- **REST API**: Full programmatic control
- **Docker Support**: Easy deployment on DigitalOcean or any VPS

## 📊 Trading Strategies

### RSI (Relative Strength Index)
- **Buy Signal**: RSI below 30 (oversold)
- **Sell Signal**: RSI above 70 (overbought)
- Moderate-risk adaptation with configurable thresholds

### MACD (Moving Average Convergence Divergence)
- **Buy Signal**: MACD line crosses above signal line (bullish crossover)
- **Sell Signal**: MACD line crosses below signal line (bearish crossover)
- Uses 12/26/9 default periods

### EMA Crossover
- **Buy Signal**: Short EMA (9) crosses above Long EMA (21) - Golden Cross
- **Sell Signal**: Short EMA (9) crosses below Long EMA (21) - Death Cross

### Combined Strategy (Recommended)
- Requires 2 out of 3 indicators to agree before trading
- Higher confidence threshold for entries
- Reduces false signals and improves win rate

## 🛡️ Risk Management

| Setting | Default | Description |
|---------|---------|-------------|
| Max Risk per Trade | 2% | Maximum portfolio percentage at risk per trade |
| Max Open Positions | 3 | Maximum concurrent positions |
| Stop Loss | 5% | Automatic exit on downside |
| Take Profit | 10% | Automatic exit on upside |
| Trailing Stop | 2% | Locks in profits as price moves favorably |

## 🔧 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Binance.US account with API access

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/crypto-grok-binance-bot.git
cd crypto-grok-binance-bot

# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your Binance.US API credentials

# Build the project
npm run build

# Run tests
npm test

# Start in development mode
npm run dev

# Start in production mode
npm start
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the bot
docker-compose down
```

## ☁️ DigitalOcean Deployment

### 1. Create a Droplet
- Choose Ubuntu 22.04 LTS
- Select at least 1GB RAM / 1 CPU
- Add SSH key for access

### 2. SSH into your droplet
```bash
ssh root@your-droplet-ip
```

### 3. Install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

### 4. Clone and configure
```bash
git clone https://github.com/yourusername/crypto-grok-binance-bot.git
cd crypto-grok-binance-bot
cp .env.example .env
nano .env  # Add your Binance.US API keys
```

### 5. Build and run
```bash
# Build TypeScript
npm install
npm run build

# Start with Docker
docker-compose up -d
```

### 6. Access Dashboard
Open `http://your-droplet-ip:3000` in your browser

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/status` | Bot status and configuration |
| POST | `/api/start` | Start trading |
| POST | `/api/stop` | Stop trading |
| GET | `/api/balances` | Account balances |
| GET | `/api/positions` | Open positions |
| GET | `/api/trades` | Trade history |
| GET | `/api/stats` | Trading statistics |
| GET | `/api/signals` | Current trading signals |

## ⚙️ Configuration

All configuration is done via environment variables. See `.env.example` for all options.

### Key Settings

```env
# API Keys (Required for live trading)
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret

# Trading Pairs
TRADING_PAIRS=BTCUSD,ETHUSD

# Risk Management
MAX_RISK_PER_TRADE=2
STOP_LOSS_PERCENT=5
TAKE_PROFIT_PERCENT=10

# Strategy: RSI, MACD, EMA_CROSSOVER, COMBINED
STRATEGY=COMBINED

# Paper Trading (recommended for testing)
PAPER_TRADING=true
```

## ⚠️ Disclaimer

**IMPORTANT**: This trading bot is for educational purposes. Cryptocurrency trading involves significant risk and you can lose money. 

- Always start with paper trading to validate strategies
- Never invest more than you can afford to lose
- Past performance does not guarantee future results
- The developers are not responsible for any financial losses

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.