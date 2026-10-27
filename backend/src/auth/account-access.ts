const instructorEmail = 'decode.instructor@gmail.com';

export function isInstructorEmail(email: string) {
  return email.trim().toLowerCase() === instructorEmail;
}

// This deployment has one instructor. Other stored roles do not grant access.
export function publicAccount<T extends { email: string; role: string }>(user: T) {
  return {
    ...user,
    role: isInstructorEmail(user.email) && user.role === 'INSTRUCTOR'
      ? 'INSTRUCTOR' as const
      : 'STUDENT' as const,
  };
}
