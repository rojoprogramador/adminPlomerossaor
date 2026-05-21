const ok = (res, data, status = 200) => res.status(status).json(data);
const err = (res, message, status = 400) => res.status(status).json({ error: message });
const serverErr = (res, e) => {
  console.error(e);
  return res.status(500).json({ error: 'Error interno del servidor' });
};

module.exports = { ok, err, serverErr };
