// NextAuth type augmentation — add `role`, `username`, `id`, `permissions` to the JWT token + session user
import 'next-auth'
import 'next-auth/jwt'
import type { Permissions, RoleId } from '@/lib/permissions'

declare module 'next-auth' {
  interface User {
    id?: string
    role?: RoleId
    username?: string
    permissions?: Permissions | null
  }
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: RoleId
      username?: string
      permissions?: Permissions | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: RoleId
    username?: string
    user_id?: string
    permissions?: Permissions | null
  }
}
