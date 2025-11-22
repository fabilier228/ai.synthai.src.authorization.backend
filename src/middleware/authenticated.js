module.exports = (req, res, next) => {
  if (!req.session.user?.accessToken) {
    return res.status(401).json({ error: 'Access denied' });
  }
  next();
};
