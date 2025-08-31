# Stock Visualizer & Trading Platform

A powerful desktop application built with Tauri 2, React, and TypeScript for visualizing stock data from Excel files and executing trades through Interactive Brokers TWS.

## Features

### Data Visualization
- **Interactive Charts**: Line charts with technical indicators (SMA, EMA)
- **Candlestick Charts**: Professional OHLC candlestick visualization
- **Volume Analysis**: Volume charts with trend detection
- **Excel Grid**: Edit and save data directly back to Excel files

### Trading Capabilities
- **IB TWS Integration**: Connect directly to Interactive Brokers
- **Trading Algorithms**: 
  - Momentum Strategy
  - Mean Reversion Strategy
  - Breakout Strategy
- **Order Management**: Place market and limit orders with stop loss/take profit
- **Risk Controls**: Position sizing, account balance monitoring
- **Backtesting**: Test strategies on historical data

### Excel Integration
- **Read Excel Files**: Load .xlsx files with stock data
- **Write Back**: Save modifications and trade logs to Excel
- **Real-time Updates**: Cell-level editing with instant save

## Prerequisites

1. **Rust**: Required for Tauri backend
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Node.js**: Version 18 or higher

3. **Interactive Brokers TWS** (Optional): For live trading
   - Download from: https://www.interactivebrokers.com/en/trading/tws.php
   - Enable API connections in TWS settings
   - Use port 7497 for paper trading or 7496 for live trading

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the application:
   ```bash
   npm run build
   ```

## Running the Application

### Development Mode
```bash
npm run tauri dev
```

### Production Build
```bash
npm run tauri build
```

The built application will be in `src-tauri/target/release/`

## Usage

1. **Load Excel Data**:
   - Click "Load Excel" button
   - Select your Excel file containing stock data
   - Expected columns: Date, Symbol, Open, High, Low, Close, Volume

2. **View Charts**:
   - Navigate to the Charts tab
   - View price charts with SMA indicators
   - Scroll down for candlestick visualization

3. **Edit Data**:
   - Go to Data Grid tab
   - Click any cell to edit
   - Click "Save" to write changes to Excel

4. **Connect to IB TWS**:
   - Start TWS and enable API connections
   - Click "Connect to IB" button
   - Account balance will display when connected

5. **Trading**:
   - Select a strategy (Momentum, Mean Reversion, Breakout)
   - Click "Generate Trading Signal" for recommendations
   - Use Order Panel to place trades
   - All trades are logged to Excel

6. **Backtesting**:
   - Go to Backtest tab
   - Select a strategy
   - Click "Run Backtest" to see historical performance

## Project Structure

```
stock-visualizer/
├── src/                    # React frontend
│   ├── components/        # UI components
│   ├── services/         # Business logic
│   └── App.tsx           # Main application
├── src-tauri/            # Rust backend
│   └── src/
│       ├── excel.rs      # Excel operations
│       └── lib.rs        # Tauri commands
└── package.json
```

## Technologies Used

- **Frontend**:
  - React 19 with TypeScript
  - Tailwind CSS for styling
  - Recharts for line/area charts
  - Plotly.js for candlestick charts
  - AG-Grid for data tables
  - Framer Motion for animations

- **Backend**:
  - Tauri 2 for desktop integration
  - Rust with Calamine for Excel operations
  - rust_xlsxwriter for Excel writing

- **Trading**:
  - @stoqey/ib for IB TWS integration
  - Technical Indicators library
  - Custom algorithm implementations

## API Configuration

The application connects to IB TWS on:
- **Paper Trading**: Port 7497 (default)
- **Live Trading**: Port 7496

To change the port, modify the `port` property in `src/services/ib-api.service.ts`

## Excel File Format

Your Excel file should have the following columns:
- Date (YYYY-MM-DD format)
- Symbol (stock ticker)
- Open (price)
- High (price)
- Low (price)
- Close (price)
- Volume (number of shares)
- Adjusted Close (optional)

## Troubleshooting

### Rust Not Found
Install Rust from: https://rustup.rs/

### IB Connection Failed
1. Ensure TWS is running
2. Enable API connections in TWS Configuration
3. Check the port number matches your TWS settings
4. For paper trading, use port 7497

### Excel File Not Loading
- Ensure the file is a valid .xlsx format
- Check that the first row contains headers
- Verify column names match expected format

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.