const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  console.log('🔍 Auth middleware - token:', token ? 'Present' : 'Missing');
  
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    console.log('🔍 Auth middleware - decoded:', decoded);
    
    // Normalize the user object to ensure we have id and userId
    req.user = {
      ...decoded,
      _id: decoded.userId || decoded._id || decoded.id,
      id: decoded.userId || decoded._id || decoded.id,
      userId: decoded.userId || decoded._id || decoded.id
    };
    
    console.log('🔍 Auth middleware - req.user:', req.user);
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = auth; 