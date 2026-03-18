import React, { useState, useEffect } from 'react';
import { api } from './api';
import './App.css';

function App() {
    const [activeTab, setActiveTab] = useState('comparison');
    const [rebalanceData, setRebalanceData] = useState(null);
    const [holdingsData, setHoldingsData] = useState(null);
    const [historyData, setHistoryData] = useState(null);
    const [modelFunds, setModelFunds] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [rebalance, holdings, history, funds] = await Promise.all([
                api.getRebalance(),
                api.getHoldings(),
                api.getHistory(),
                api.getModelFunds()
            ]);
            
            setRebalanceData(rebalance);
            setHoldingsData(holdings);
            setHistoryData(history);
            setModelFunds(funds);
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Error loading data. Make sure backend is running.');
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!rebalanceData) {
            alert('No data to save');
            return;
        }
        
        try {
            console.log('Saving recommendation...', rebalanceData);
            
            // Prepare the data for saving
            const saveData = {
                client_id: rebalanceData.client_id || 'C001',
                portfolio_value: rebalanceData.portfolio_value,
                total_buy: rebalanceData.total_buy,
                total_sell: rebalanceData.total_sell,
                net_cash: rebalanceData.fresh_cash,
                funds: rebalanceData.funds.map(fund => ({
                    fund_id: fund.fund_id,
                    fund_name: fund.fund_name,
                    action: fund.action,
                    amount: fund.amount,
                    current_pct: fund.current_pct,
                    target_pct: fund.target_pct,
                    in_plan: fund.in_plan
                }))
            };
            
            const result = await api.saveRebalance(saveData);
            
            if (result.success) {
                alert('✅ Recommendation saved successfully!');
                // Refresh history
                const history = await api.getHistory();
                setHistoryData(history);
            } else {
                alert('❌ Failed to save: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('❌ Error saving recommendation: ' + error.message);
        }
    };

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <div className="App">
            <header className="header">
                <h1>Portfolio Rebalancer - Amit Sharma</h1>
            </header>

            <nav className="nav">
                <button 
                    className={activeTab === 'comparison' ? 'active' : ''}
                    onClick={() => setActiveTab('comparison')}
                >
                    Comparison
                </button>
                <button 
                    className={activeTab === 'holdings' ? 'active' : ''}
                    onClick={() => setActiveTab('holdings')}
                >
                    Holdings
                </button>
                <button 
                    className={activeTab === 'history' ? 'active' : ''}
                    onClick={() => setActiveTab('history')}
                >
                    History
                </button>
                <button 
                    className={activeTab === 'edit' ? 'active' : ''}
                    onClick={() => setActiveTab('edit')}
                >
                    Edit Plan
                </button>
            </nav>

            <main className="main">
                {activeTab === 'comparison' && rebalanceData && (
                    <ComparisonTab data={rebalanceData} onSave={handleSave} />
                )}
                
                {activeTab === 'holdings' && holdingsData && (
                    <HoldingsTab data={holdingsData} />
                )}
                
                {activeTab === 'history' && historyData && (
                    <HistoryTab data={historyData} />
                )}
                
                {activeTab === 'edit' && modelFunds && (
                    <EditPlanTab 
                        funds={modelFunds.funds} 
                        onUpdate={loadData}
                    />
                )}
            </main>
        </div>
    );
}

function ComparisonTab({ data, onSave }) {
    return (
        <div>
            <div className="tab-header">
                <h2>Portfolio Comparison</h2>
                <button onClick={onSave} className="save-btn">Save Recommendation</button>
            </div>
            
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Fund</th>
                        <th>Current %</th>
                        <th>Target %</th>
                        <th>Drift</th>
                        <th>Action</th>
                        <th>Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    {data.funds.map((fund, index) => (
                        <tr key={index} className={!fund.in_plan ? 'review-row' : ''}>
                            <td>
                                {fund.fund_name}
                                {!fund.in_plan && <small> (Not in plan)</small>}
                            </td>
                            <td>{fund.current_pct}%</td>
                            <td>{fund.target_pct}{fund.in_plan ? '%' : ''}</td>
                            <td>{fund.drift}</td>
                            <td>
                                <span className={`action-badge ${fund.action.toLowerCase()}`}>
                                    {fund.action}
                                </span>
                            </td>
                            <td>₹{Number(fund.amount).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            <div className="summary-cards">
                <div className="card buy">
                    <div>Total to BUY</div>
                    <div className="amount">₹{Number(data.total_buy).toLocaleString()}</div>
                </div>
                <div className="card sell">
                    <div>Total to SELL</div>
                    <div className="amount">₹{Number(data.total_sell).toLocaleString()}</div>
                </div>
                <div className="card fresh">
                    <div>Fresh Money Needed</div>
                    <div className="amount">₹{Number(data.fresh_cash).toLocaleString()}</div>
                </div>
            </div>
        </div>
    );
}

function HoldingsTab({ data }) {
    return (
        <div>
            <h2>Current Holdings</h2>
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Fund</th>
                        <th>Current Value (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    {data.holdings.map((holding, index) => (
                        <tr key={index}>
                            <td>{holding.fund_name}</td>
                            <td>₹{holding.current_value.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td><strong>Total Portfolio Value</strong></td>
                        <td><strong>₹{data.total_value.toLocaleString()}</strong></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

function HistoryTab({ data }) {
    return (
        <div>
            <h2>Recommendation History</h2>
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Portfolio Value</th>
                        <th>Buy Amount</th>
                        <th>Sell Amount</th>
                        <th>Net Cash</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {data.sessions.map((session, index) => (
                        <tr key={index}>
                            <td>{new Date(session.created_at).toLocaleDateString()}</td>
                            <td>₹{session.portfolio_value.toLocaleString()}</td>
                            <td>₹{session.total_to_buy.toLocaleString()}</td>
                            <td>₹{session.total_to_sell.toLocaleString()}</td>
                            <td>₹{session.net_cash_needed.toLocaleString()}</td>
                            <td>
                                <span className={`status-badge ${session.status.toLowerCase()}`}>
                                    {session.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function EditPlanTab({ funds, onUpdate }) {
    const [editedFunds, setEditedFunds] = useState([...funds]);
    const [saving, setSaving] = useState(false);
    
    const handleChange = (index, value) => {
        const newFunds = [...editedFunds];
        newFunds[index].allocation_pct = parseFloat(value) || 0;
        setEditedFunds(newFunds);
    };
    
    const total = editedFunds.reduce((sum, f) => sum + f.allocation_pct, 0);
    
    const handleSave = async () => {
        if (Math.abs(total - 100) > 0.01) {
            alert(`Total must be exactly 100% (currently ${total}%)`);
            return;
        }
        
        setSaving(true);
        try {
            console.log('Updating funds:', editedFunds);
            const result = await api.updateModelFunds(editedFunds);
            
            if (result.success) {
                alert('✅ Model portfolio updated successfully!');
                onUpdate(); // Refresh data
            } else {
                alert('❌ Update failed: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Update error:', error);
            alert('❌ Error updating: ' + error.message);
        } finally {
            setSaving(false);
        }
    };
    
    return (
        <div>
            <h2>Edit Model Portfolio</h2>
            <div className="edit-form">
                {editedFunds.map((fund, index) => (
                    <div key={fund.fund_id} className="form-row">
                        <label>{fund.fund_name}</label>
                        <input
                            type="number"
                            step="0.1"
                            value={fund.allocation_pct}
                            onChange={(e) => handleChange(index, e.target.value)}
                            disabled={saving}
                        />
                        <span>%</span>
                    </div>
                ))}
                
                <div className="form-row total">
                    <label><strong>Total</strong></label>
                    <span className={Math.abs(total - 100) < 0.01 ? 'valid' : 'invalid'}>
                        {total.toFixed(1)}%
                    </span>
                </div>
                
                <button 
                    onClick={handleSave}
                    disabled={Math.abs(total - 100) > 0.01 || saving}
                    className="save-btn"
                >
                    {saving ? 'Saving...' : 'Update Model Portfolio'}
                </button>
            </div>
        </div>
    );
}

export default App;