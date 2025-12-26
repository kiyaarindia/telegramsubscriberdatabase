const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function verifyLogin() {
    try {
        console.log('Testing login with admin/admin124...');
        const response = await axios.post(`${API_URL}/login`, {
            username: 'admin',
            password: 'admin124'
        });

        if (response.data.success) {
            console.log('✅ Login Successful!');
        } else {
            console.log('❌ Login Failed:', response.data.message);
        }
    } catch (error) {
        console.error('❌ Error during login test:', error.response ? error.response.data : error.message);
    }
}

verifyLogin();
