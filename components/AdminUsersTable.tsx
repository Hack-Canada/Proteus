import React from "react";

interface AdminUser {
  name: string;
  email: string;
  role: string;
}

interface AdminUsersTableProps {
  users: AdminUser[];
}

const AdminUsersTable: React.FC<AdminUsersTableProps> = ({ users }) => {
  return (
    <div className="overflow-x-auto rounded-3xl border bg-card dark:border-white/[0.06]">
      <table className="min-w-full" aria-label="Admin Users Table">
        <thead>
          <tr className="bg-muted/60">
            <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
              Name
            </th>
            <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
              Email
            </th>
            <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
              Role
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {users.map((user, index) => (
            <tr
              key={index}
              className="transition-colors duration-200 hover:bg-muted/50"
            >
              <td className="whitespace-nowrap px-6 py-4 text-sm">
                {user.name}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm">
                {user.email}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
                  {user.role}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminUsersTable;
