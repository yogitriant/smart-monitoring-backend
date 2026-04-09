const Joi = require("joi");

/**
 * Middleware factory: validasi req.body menggunakan Joi schema.
 * Jika gagal, langsung return 400 dengan pesan error.
 */
function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const messages = error.details.map((d) => d.message);
      return res.status(400).json({ message: messages.join(", ") });
    }
    next();
  };
}

// ============ AUTH SCHEMAS ============ //

const loginSchema = Joi.object({
  email: Joi.string().required().messages({
    "any.required": "Email/username wajib diisi",
    "string.empty": "Email/username tidak boleh kosong",
  }),
  password: Joi.string().required().messages({
    "any.required": "Password wajib diisi",
    "string.empty": "Password tidak boleh kosong",
  }),
});

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).required().messages({
    "any.required": "Username wajib diisi",
    "string.min": "Username minimal 3 karakter",
    "string.max": "Username maksimal 50 karakter",
  }),
  email: Joi.string().email().required().messages({
    "any.required": "Email wajib diisi",
    "string.email": "Format email tidak valid",
  }),
  password: Joi.string()
    .min(8)
    .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&.])[A-Za-z\\d@$!%*?&.]{8,}$"))
    .required()
    .messages({
    "any.required": "Password wajib diisi",
    "string.min": "Password minimal 8 karakter",
    "string.pattern.base": "Password harus mengandung huruf besar, huruf kecil, angka, dan karakter spesial.",
  }),
});

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required().messages({
    "any.required": "Password lama wajib diisi",
    "string.empty": "Password lama tidak boleh kosong",
  }),
  newPassword: Joi.string()
    .min(8)
    .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&.])[A-Za-z\\d@$!%*?&.]{8,}$"))
    .required()
    .messages({
    "any.required": "Password baru wajib diisi",
    "string.min": "Password minimal 8 karakter",
    "string.pattern.base": "Password harus mengandung huruf besar, huruf kecil, angka, dan karakter spesial.",
  }),
});

module.exports = { validate, loginSchema, registerSchema, changePasswordSchema };
