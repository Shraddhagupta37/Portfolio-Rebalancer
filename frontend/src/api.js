import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

// Create axios instance with default config
const apiClient = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const api = {
    // Test connection
    testConnection: async () => {
        try {
            const response = await apiClient.get('/test');
            return response.data;
        } catch (error) {
            console.error('Connection test failed:', error);
            throw error;
        }
    },

    // Get rebalancing recommendations
    getRebalance: async () => {
        try {
            const response = await apiClient.get('/rebalance');
            return response.data;
        } catch (error) {
            console.error('Error in getRebalance:', error);
            throw error;
        }
    },
    
    // Save recommendation
    saveRebalance: async (data) => {
        try {
            console.log('Saving rebalance data:', data);
            const response = await apiClient.post('/save-rebalance', data);
            console.log('Save response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error in saveRebalance:', error);
            if (error.response) {
                // The request was made and the server responded with a status code
                console.error('Server response:', error.response.data);
                throw new Error(error.response.data.error || 'Server error');
            } else if (error.request) {
                // The request was made but no response was received
                console.error('No response from server');
                throw new Error('Cannot connect to server. Is backend running?');
            } else {
                // Something happened in setting up the request
                throw error;
            }
        }
    },
    
    // Get holdings
    getHoldings: async () => {
        try {
            const response = await apiClient.get('/holdings');
            return response.data;
        } catch (error) {
            console.error('Error in getHoldings:', error);
            throw error;
        }
    },
    
    // Get history
    getHistory: async () => {
        try {
            const response = await apiClient.get('/history');
            return response.data;
        } catch (error) {
            console.error('Error in getHistory:', error);
            throw error;
        }
    },
    
    // Get model funds
    getModelFunds: async () => {
        try {
            const response = await apiClient.get('/model-funds');
            return response.data;
        } catch (error) {
            console.error('Error in getModelFunds:', error);
            throw error;
        }
    },
    
    // Update model funds
    updateModelFunds: async (funds) => {
        try {
            console.log('Updating model funds:', funds);
            const response = await apiClient.put('/model-funds', { funds });
            console.log('Update response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error in updateModelFunds:', error);
            if (error.response) {
                throw new Error(error.response.data.error || 'Update failed');
            }
            throw error;
        }
    }
};

// Test connection on load
api.testConnection()
    .then(() => console.log('✅ Connected to backend'))
    .catch(() => console.error('❌ Cannot connect to backend. Make sure it\'s running on port 5000'));