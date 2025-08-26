const fetch = require('node-fetch');

// Test the profile endpoint
async function testProfileEndpoint() {
  try {
    // First, let's login to get a token
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'syogesh565@gmail.com', // Admin user email
        password: 'qwER1234!'          // Admin user password
      })
    });

    if (!loginResponse.ok) {
      console.log('Login failed:', await loginResponse.text());
      return;
    }

    const loginData = await loginResponse.json();
    console.log('Login successful, token:', loginData.token);
    console.log('User data:', loginData.user);

    // Now test the profile endpoint
    const profileResponse = await fetch('http://localhost:5000/api/auth/profile', {
      headers: {
        'Authorization': `Bearer ${loginData.token}`
      }
    });

    if (!profileResponse.ok) {
      console.log('Profile fetch failed:', await profileResponse.text());
      return;
    }

    const profileData = await profileResponse.json();
    console.log('Profile data:', profileData.user);
    
    // Check if all required fields are present
    const requiredFields = ['_id', 'email', 'role', 'firstName', 'lastName'];
    const missingFields = requiredFields.filter(field => !profileData.user[field]);
    
    if (missingFields.length > 0) {
      console.log('Missing fields:', missingFields);
    } else {
      console.log('✅ All required fields are present');
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testProfileEndpoint(); 