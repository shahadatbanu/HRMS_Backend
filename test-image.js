const fetch = require('node-fetch');

// Test if the profile image is accessible
async function testProfileImage() {
  try {
    const imageUrl = 'http://localhost:5000/uploads/1754041673008-810574019-Photo-1.jpeg';
    console.log('Testing image URL:', imageUrl);
    
    const response = await fetch(imageUrl);
    
    if (response.ok) {
      console.log('✅ Image is accessible');
      console.log('Content-Type:', response.headers.get('content-type'));
      console.log('Content-Length:', response.headers.get('content-length'));
    } else {
      console.log('❌ Image is not accessible');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testProfileImage(); 