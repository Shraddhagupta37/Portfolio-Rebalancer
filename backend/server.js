const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// const path = require('path');

// Serve static files from frontend build in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/build')));
    
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
    });
}

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const dbPath = path.join(__dirname, 'model_portfolio.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('✅ Connected to SQLite database at:', dbPath);
    }
});

// Helper functions
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

// ==================== API ROUTES ====================

// 1. GET rebalancing recommendations
app.get('/api/rebalance', async (req, res) => {
    try {
        console.log('📊 Fetching rebalance data...');
        const clientId = 'C001';
        
        // Get model funds
        const modelFunds = await query('SELECT * FROM model_funds ORDER BY fund_id');
        console.log('Model funds:', modelFunds);
        
        // Get client holdings
        const holdings = await query('SELECT * FROM client_holdings WHERE client_id = ?', [clientId]);
        console.log('Holdings:', holdings);
        
        // Calculate total
        const totalValue = holdings.reduce((sum, h) => sum + h.current_value, 0);
        console.log('Total portfolio value:', totalValue);
        
        // Process each fund
        const recommendations = [];
        let totalBuy = 0;
        let totalSell = 0;
        
        // Process model funds
        for (const fund of modelFunds) {
            const holding = holdings.find(h => h.fund_id === fund.fund_id);
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
                current_pct: Number(currentPct.toFixed(1)),
                target_pct: targetPct,
                drift: Number(drift.toFixed(1)),
                action: action,
                amount: Math.round(amount),
                in_plan: true
            });
        }
        
        // Process non-plan funds
        for (const holding of holdings) {
            const inPlan = modelFunds.find(f => f.fund_id === holding.fund_id);
            if (!inPlan) {
                const currentPct = (holding.current_value / totalValue * 100);
                recommendations.push({
                    fund_id: holding.fund_id,
                    fund_name: holding.fund_name,
                    current_value: holding.current_value,
                    current_pct: Number(currentPct.toFixed(1)),
                    target_pct: null,
                    drift: null,
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
        console.error('❌ Error in /api/rebalance:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 2. POST save rebalancing recommendation (FIXED VERSION)
app.post('/api/save-rebalance', async (req, res) => {
    try {
        console.log('💾 Saving recommendation...');
        console.log('Request body:', req.body);
        
        const { client_id, portfolio_value, total_buy, total_sell, net_cash, funds } = req.body;
        
        // Validate required fields
        if (!client_id || !portfolio_value || !funds) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }
        
        // Insert session
        const sessionResult = await run(
            `INSERT INTO rebalance_sessions 
             (client_id, created_at, portfolio_value, total_to_buy, total_to_sell, net_cash_needed, status)
             VALUES (?, datetime('now'), ?, ?, ?, ?, 'PENDING')`,
            [client_id, portfolio_value, total_buy || 0, total_sell || 0, net_cash || 0]
        );
        
        const sessionId = sessionResult.id;
        console.log('Session created with ID:', sessionId);
        
        // Insert each fund action
        for (const fund of funds) {
            await run(
                `INSERT INTO rebalance_items
                 (session_id, fund_id, fund_name, action, amount, current_pct, target_pct, is_model_fund)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    sessionId,
                    fund.fund_id || 'UNKNOWN',
                    fund.fund_name || 'Unknown Fund',
                    fund.action || 'HOLD',
                    fund.amount || 0,
                    fund.current_pct || 0,
                    fund.target_pct || 0,
                    fund.in_plan ? 1 : 0
                ]
            );
        }
        
        console.log('✅ Recommendation saved successfully with session ID:', sessionId);
        
        res.json({ 
            success: true, 
            message: 'Recommendation saved successfully',
            session_id: sessionId
        });
        
    } catch (error) {
        console.error('❌ Error in /api/save-rebalance:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 3. GET client holdings
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
        console.error('❌ Error in /api/holdings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. GET recommendation history
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
        console.error('❌ Error in /api/history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. GET model funds
app.get('/api/model-funds', async (req, res) => {
    try {
        const funds = await query('SELECT * FROM model_funds ORDER BY fund_id');
        res.json({
            success: true,
            funds: funds
        });
        
    } catch (error) {
        console.error('❌ Error in /api/model-funds:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. PUT update model funds (FIXED VERSION)
app.put('/api/model-funds', async (req, res) => {
    try {
        console.log('📝 Updating model funds...');
        console.log('Request body:', req.body);
        
        const { funds } = req.body;
        
        if (!funds || !Array.isArray(funds)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid funds data' 
            });
        }
        
        // Validate total = 100%
        const total = funds.reduce((sum, f) => sum + (f.allocation_pct || 0), 0);
        console.log('Total allocation:', total);
        
        if (Math.abs(total - 100) > 0.01) {
            return res.status(400).json({ 
                success: false, 
                error: `Total allocation must be exactly 100% (currently ${total}%)` 
            });
        }
        
        // Update each fund
        for (const fund of funds) {
            if (!fund.fund_id) {
                console.error('Missing fund_id in:', fund);
                continue;
            }
            
            await run(
                'UPDATE model_funds SET allocation_pct = ? WHERE fund_id = ?',
                [fund.allocation_pct, fund.fund_id]
            );
            console.log(`Updated ${fund.fund_id} to ${fund.allocation_pct}%`);
        }
        
        console.log('✅ Model funds updated successfully');
        
        res.json({ 
            success: true, 
            message: 'Model portfolio updated successfully' 
        });
        
    } catch (error) {
        console.error('❌ Error in /api/model-funds PUT:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Test endpoint to verify server is running
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'Server is running!' });
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📁 Database path: ${dbPath}`);
    console.log('\nAvailable endpoints:');
    console.log('  GET  /api/test');
    console.log('  GET  /api/rebalance');
    console.log('  POST /api/save-rebalance');
    console.log('  GET  /api/holdings');
    console.log('  GET  /api/history');
    console.log('  GET  /api/model-funds');
    console.log('  PUT  /api/model-funds\n');
});