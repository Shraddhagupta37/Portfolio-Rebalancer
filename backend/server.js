const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// IMPORTANT: Place your model_portfolio.db file here
const dbPath = path.join(__dirname, 'model_portfolio.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
    }
});

// Helper function to run queries with promises
const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
};

// API Routes

// 1. Get rebalancing recommendations for Amit Sharma (C001)
app.get('/api/rebalance', async (req, res) => {
    try {
        const clientId = 'C001';
        
        // Get model funds (target allocation)
        const modelFunds = await query('SELECT * FROM model_funds ORDER BY fund_id');
        
        // Get client holdings
        const holdings = await query('SELECT * FROM client_holdings WHERE client_id = ?', [clientId]);
        
        // Calculate total portfolio value
        const totalValue = holdings.reduce((sum, h) => sum + h.current_value, 0);
        
        // Create map of holdings
        const holdingsMap = {};
        holdings.forEach(h => {
            holdingsMap[h.fund_id] = h;
        });
        
        // Calculate recommendations
        const recommendations = [];
        let totalBuy = 0;
        let totalSell = 0;
        
        // Process funds in plan
        for (const fund of modelFunds) {
            const holding = holdingsMap[fund.fund_id];
            const currentValue = holding ? holding.current_value : 0;
            const currentPct = (currentValue / totalValue * 100);
            const targetPct = fund.allocation_pct;
            const drift = targetPct - currentPct;
            const amount = Math.abs(drift / 100 * totalValue);
            
            let action = 'HOLD';
            if (drift > 0.1) {
                action = 'BUY';
                totalBuy += amount;
            } else if (drift < -0.1) {
                action = 'SELL';
                totalSell += amount;
            }
            
            recommendations.push({
                fund_id: fund.fund_id,
                fund_name: fund.fund_name,
                current_value: currentValue,
                current_pct: currentPct.toFixed(1),
                target_pct: targetPct,
                drift: drift.toFixed(1),
                action: action,
                amount: Math.round(amount),
                in_plan: true
            });
        }
        
        // Handle funds not in plan
        for (const holding of holdings) {
            const inPlan = modelFunds.find(f => f.fund_id === holding.fund_id);
            if (!inPlan) {
                const currentPct = (holding.current_value / totalValue * 100);
                recommendations.push({
                    fund_id: holding.fund_id,
                    fund_name: holding.fund_name,
                    current_value: holding.current_value,
                    current_pct: currentPct.toFixed(1),
                    target_pct: 'N/A',
                    drift: 'N/A',
                    action: 'REVIEW',
                    amount: holding.current_value,
                    in_plan: false
                });
            }
        }
        
        res.json({
            success: true,
            client_id: clientId,
            portfolio_value: totalValue,
            total_buy: Math.round(totalBuy),
            total_sell: Math.round(totalSell),
            fresh_cash: Math.round(totalBuy - totalSell),
            funds: recommendations
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Save rebalancing recommendation
app.post('/api/save-rebalance', async (req, res) => {
    try {
        const { client_id, portfolio_value, total_buy, total_sell, net_cash, funds } = req.body;
        
        // Insert session
        const sessionResult = await run(
            `INSERT INTO rebalance_sessions 
             (client_id, created_at, portfolio_value, total_to_buy, total_to_sell, net_cash_needed, status)
             VALUES (?, datetime('now'), ?, ?, ?, ?, 'PENDING')`,
            [client_id, portfolio_value, total_buy, total_sell, net_cash]
        );
        
        const sessionId = sessionResult.id;
        
        // Insert each fund action
        for (const fund of funds) {
            await run(
                `INSERT INTO rebalance_items
                 (session_id, fund_id, fund_name, action, amount, current_pct, target_pct, is_model_fund)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    sessionId,
                    fund.fund_id,
                    fund.fund_name,
                    fund.action,
                    fund.amount,
                    fund.current_pct,
                    fund.target_pct,
                    fund.in_plan ? 1 : 0
                ]
            );
        }
        
        res.json({ 
            success: true, 
            message: 'Recommendation saved successfully',
            session_id: sessionId
        });
        
    } catch (error) {
        console.error('Error saving:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Get client holdings
app.get('/api/holdings', async (req, res) => {
    try {
        const holdings = await query(
            'SELECT * FROM client_holdings WHERE client_id = ? ORDER BY fund_id',
            ['C001']
        );
        
        const totalValue = holdings.reduce((sum, h) => sum + h.current_value, 0);
        
        res.json({
            success: true,
            holdings: holdings,
            total_value: totalValue
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. Get recommendation history
app.get('/api/history', async (req, res) => {
    try {
        const sessions = await query(
            'SELECT * FROM rebalance_sessions WHERE client_id = ? ORDER BY created_at DESC',
            ['C001']
        );
        
        res.json({
            success: true,
            sessions: sessions
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. Get model funds
app.get('/api/model-funds', async (req, res) => {
    try {
        const funds = await query('SELECT * FROM model_funds ORDER BY fund_id');
        res.json({
            success: true,
            funds: funds
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. Update model funds
app.put('/api/model-funds', async (req, res) => {
    try {
        const { funds } = req.body;
        
        // Validate total = 100%
        const total = funds.reduce((sum, f) => sum + f.allocation_pct, 0);
        if (Math.abs(total - 100) > 0.01) {
            return res.status(400).json({ 
                success: false, 
                error: 'Total allocation must be exactly 100%' 
            });
        }
        
        // Update each fund
        for (const fund of funds) {
            await run(
                'UPDATE model_funds SET allocation_pct = ? WHERE fund_id = ?',
                [fund.allocation_pct, fund.fund_id]
            );
        }
        
        res.json({ 
            success: true, 
            message: 'Model portfolio updated successfully' 
        });
        
    } catch (error) {
        console.error('Error updating:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Make sure model_portfolio.db is in: ${dbPath}`);
});