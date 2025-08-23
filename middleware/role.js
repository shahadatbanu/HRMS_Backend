const role = (requiredRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Access denied - no user found' });
  }
  
  // Handle both single role and array of roles
  const allowedRoles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ 
      message: `Access denied - required roles: ${allowedRoles.join(', ')}, user role: ${req.user.role}` 
    });
  }
  
  next();
};

module.exports = role; 