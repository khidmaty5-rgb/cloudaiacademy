"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_ROLES = void 0;
exports.isUserRole = isUserRole;
// Dependency-free canonical roles, shared with the Next application.
exports.USER_ROLES = ['student', 'teacher', 'reviewer', 'editor', 'admin'];
function isUserRole(value) {
    return typeof value === 'string' && exports.USER_ROLES.includes(value);
}
//# sourceMappingURL=user-roles.js.map