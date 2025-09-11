const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    // Normalize the user object to ensure we have id and userId
    req.user = {
      ...decoded,
      _id: decoded.userId || decoded._id || decoded.id,
      id: decoded.userId || decoded._id || decoded.id,
      userId: decoded.userId || decoded._id || decoded.id
    };
    
    next();
  } catch (err) {
    // Handle different types of JWT errors more gracefully
    if (err.name === 'TokenExpiredError') {
      console.log('Token expired for request to:', req.path);
      return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
    } else if (err.name === 'JsonWebTokenError') {
      console.log('Invalid token for request to:', req.path);
      return res.status(401).json({ message: 'Invalid token', code: 'INVALID_TOKEN' });
    } else {
      console.error('Auth middleware error:', err);
      return res.status(401).json({ message: 'Token is not valid' });
    }
  }
};

module.exports = auth; 