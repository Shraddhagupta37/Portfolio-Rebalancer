# Portfolio Rebalancer - Mutual Fund Investment Tool

A web application that helps investors compare their current mutual fund portfolio with a recommended model portfolio and calculate exactly what to buy/sell to rebalance.

## Features

✅ **Comparison Dashboard**: Shows current % vs target % with drift analysis
✅ **Buy/Sell Recommendations**: Exact amounts in rupees for each fund
✅ **Edge Case Handling**: Funds not in plan (Axis Bluechip) and zero-value funds
✅ **History Tracking**: Save and view past recommendations
✅ **Edit Model Portfolio**: Update target allocations with 100% validation

## Tech Stack

- **Frontend**: React.js
- **Backend**: Node.js + Express
- **Database**: SQLite
- **API**: RESTful endpoints

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Backend Setup
```bash
cd backend
npm install
npm run dev

