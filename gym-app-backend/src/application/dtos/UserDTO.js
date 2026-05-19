class UserDTO {
  constructor(user) {
    this.id = user.id;
    this.email = user.email;
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.phoneNumber = user.phoneNumber;
    this.dateOfBirth = user.dateOfBirth;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
    this.avatarDataUrl = user.avatarDataUrl ?? null;
    this.membershipTier = user.membershipTier ?? 'free';
    this.proExpiresAt = user.proExpiresAt ?? null;
    this.isPro = UserDTO.isProActive(user);
    // User details (profil birleşik yanıtlarda)
    this.height = user.height;
    this.weight = user.weight;
    this.injuries = user.injuries;
  }

  /** Pro: tier === pro ve proExpiresAt gelecekte (veya tanımsız süre yok sayılır) */
  static isProActive(user) {
    if (!user || user.membershipTier !== 'pro') return false;
    const exp = user.proExpiresAt;
    if (!exp) return false;
    return new Date(exp) > new Date();
  }

  static fromEntity(user) {
    return new UserDTO(user);
  }

  static fromArray(users) {
    return users.map(user => new UserDTO(user));
  }

  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePassword(password) {
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
    return passwordRegex.test(password);
  }

  static validatePhoneNumber(phoneNumber) {
    const phoneRegex = /^(\+90|0)?[5][0-9]{9}$/;
    return phoneRegex.test(phoneNumber);
  }

  static normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    let local = String(phoneNumber).replace(/\D/g, '');
    if (local.startsWith('90')) local = local.slice(2);
    if (local.startsWith('0')) local = local.slice(1);
    if (!/^5\d{9}$/.test(local)) return phoneNumber;
    return `+90${local}`;
  }

  static normalizeDateOfBirth(dateOfBirth) {
    if (!dateOfBirth) return null;
    const raw = String(dateOfBirth).trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return dateOfBirth;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    const isValid =
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;

    if (!isValid || date > new Date()) return dateOfBirth;
    return raw;
  }

  static validateDateOfBirth(dateOfBirth) {
    if (!dateOfBirth) return true;
    const raw = String(dateOfBirth).trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day &&
      date <= new Date()
    );
  }
}

class CreateUserDTO {
  constructor(data) {
    this.email = data.email;
    this.password = data.password;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.phoneNumber = UserDTO.normalizePhoneNumber(data.phoneNumber ?? data.phone);
    this.dateOfBirth = UserDTO.normalizeDateOfBirth(data.dateOfBirth);
  }

  validate() {
    const errors = [];

    if (!this.email || !UserDTO.validateEmail(this.email)) {
      errors.push('Valid email is required');
    }

    if (!this.password || !UserDTO.validatePassword(this.password)) {
      errors.push('Password must be at least 8 characters long and contain at least one letter and one number');
    }

    if (!this.firstName || this.firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters long');
    }

    if (!this.lastName || this.lastName.trim().length < 2) {
      errors.push('Last name must be at least 2 characters long');
    }

    if (this.phoneNumber && !UserDTO.validatePhoneNumber(this.phoneNumber)) {
      errors.push('Invalid phone number format');
    }

    if (this.dateOfBirth && !UserDTO.validateDateOfBirth(this.dateOfBirth)) {
      errors.push('Invalid date of birth format. Use YYYY-MM-DD');
    }

    return errors;
  }
}

class LoginDTO {
  constructor(data) {
    this.email = data.email;
    this.password = data.password;
  }

  validate() {
    const errors = [];

    if (!this.email || !UserDTO.validateEmail(this.email)) {
      errors.push('Valid email is required');
    }

    if (!this.password || this.password.length < 1) {
      errors.push('Password is required');
    }

    return errors;
  }
}

class UserDetailsDTO {
  constructor(data) {
    this.userId = data.userId;
    this.height = data.height;
    this.weight = data.weight;
    this.injuries = data.injuries || [];
    this.goal = data.goal; // Fitness hedefi: Kilo Alma, Kilo Verme, Kilo Koruma, Kas Geliştirme
  }

  validate() {
    const errors = [];

    if (!this.userId || this.userId < 1) {
      errors.push('Valid user ID is required');
    }

    if (!this.height || this.height < 100 || this.height > 250) {
      errors.push('Height must be between 100-250 cm');
    }

    if (!this.weight || this.weight < 30 || this.weight > 300) {
      errors.push('Weight must be between 30-300 kg');
    }

    if (!Array.isArray(this.injuries)) {
      errors.push('Injuries must be an array');
    }

    const validGoals = ['Kilo Alma', 'Kilo Verme', 'Kilo Koruma', 'Kas Geliştirme'];
    if (this.goal && !validGoals.includes(this.goal)) {
      errors.push('Goal must be one of: Kilo Alma, Kilo Verme, Kilo Koruma, Kas Geliştirme');
    }

    return errors;
  }
}

module.exports = {
  UserDTO,
  CreateUserDTO,
  LoginDTO,
  UserDetailsDTO
};
