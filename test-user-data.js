const fetch = require('node-fetch');

// Test the login and profile endpoints to verify user data
async function testUserData() {
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
    console.log('✅ Login successful');
    console.log('Login response user data:', loginData.user);
    console.log('Profile image in login response:', loginData.user.profileImage);

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
    console.log('✅ Profile fetch successful');
    console.log('Profile response user data:', profileData.user);
    console.log('Profile image in profile response:', profileData.user.profileImage);

    // Test if the image is accessible
    if (profileData.user.profileImage) {
      const imageUrl = `http://localhost:5000/uploads/${profileData.user.profileImage}`;
      console.log('Testing image URL:', imageUrl);
      
      const imageResponse = await fetch(imageUrl);
      if (imageResponse.ok) {
        console.log('✅ Profile image is accessible');
        console.log('Image Content-Type:', imageResponse.headers.get('content-type'));
        console.log('Image Content-Length:', imageResponse.headers.get('content-length'));
      } else {
        console.log('❌ Profile image is not accessible');
        console.log('Status:', imageResponse.status);
      }
    } else {
      console.log('⚠️ No profile image found in user data');
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testUserData(); 