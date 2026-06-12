import { useEffect, useState, useCallback } from "react";
import { api, formatApiErrorDetail } from "../lib/api";
import { SectionHeader } from "../components/Editorial";
import { StatusBadge } from "../components/StatusBadge";
import { Skeleton } from "../components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth, ROLE_LABELS } from "../lib/auth";
import { useQuota, useLicense } from "../lib/license";

const ROLES = ["super_admin", "hotel_admin", "reception", "housekeeping", "technician"];

function CreateUserDialog({ onDone }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "reception" });
  const quota = useQuota("users");
  const { refresh } = useLicense();

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/users", form);
      toast.success("User created");
      setOpen(false);
      setForm({ email: "", name: "", password: "", role: "reception" });
      onDone?.();
      refresh();
    } catch (e) {
      toast.error("Failed", { description: formatApiErrorDetail(e.response?.data?.detail) || e.message });
    }
  };

  const reached = quota.blocked;

  return (
    <Dialog open={open} onOpenChange={(v) => !reached && setOpen(v)}>
      <DialogTrigger asChild>
        <button
          disabled={reached}
          title={reached ? `User limit reached (${quota.current}/${quota.limit})` : undefined}
          className="smallcaps ink-link text-ink-900 flex items-center gap-2 disabled:text-ink-300 disabled:cursor-not-allowed"
          data-testid="add-user-button"
        >
          <UserPlus className="w-3 h-3" />
          {reached ? `Add user · limit reached (${quota.current}/${quota.limit})` : "Add user"}
        </button>
      </DialogTrigger>
      <DialogContent className="bg-cream border border-hairline rounded-3xl p-10 shadow-apple-xl">
        <DialogHeader><DialogTitle asChild><h3 className="font-display text-3xl">Add a new user</h3></DialogTitle></DialogHeader>
        <div className="hairline my-4" />
        <form onSubmit={submit} className="space-y-6">
          <div><label className="smallcaps">Name</label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-lg" data-testid="user-name-input" /></div>
          <div><label className="smallcaps">Email</label><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-lg" data-testid="user-email-input" /></div>
          <div><label className="smallcaps">Password</label><Input required type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-lg" data-testid="user-password-input" /></div>
          <div>
            <label className="smallcaps">Role</label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger className="border-0 border-b border-ink-200 rounded-none pl-2 pr-6 mt-2 text-lg"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <button type="submit" className="w-full py-3.5 btn-apple btn-apple-primary" data-testid="submit-user">Add user</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user: me } = useAuth();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users");
      setUsers(data);
    } catch (err) {
      console.warn("Failed to load users:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleActive = async (u) => {
    try {
      await api.patch(`/users/${u.id}`, { active: !u.active });
      fetchUsers();
    } catch (e) {
      toast.error("Failed", { description: e.response?.data?.detail || e.message });
    }
  };

  const updateRole = async (u, role) => {
    try {
      await api.patch(`/users/${u.id}`, { role });
      toast.success("Role updated");
      fetchUsers();
    } catch (e) {
      toast.error("Failed", { description: e.response?.data?.detail || e.message });
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete ${u.email}?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success("Deleted");
      fetchUsers();
    } catch (e) {
      toast.error("Failed", { description: e.response?.data?.detail || e.message });
    }
  };

  return (
    <div className="space-y-10">
      <SectionHeader
        overline={`${users.length} on staff · ${users.filter(u => u.active).length} active`}
        title={<>The staff,<br /><span className="italic text-brand">in their roles.</span></>}
        lead="The night porter, the duty manager, the lone technician. Five archetypes, each with their own pass."
        right={<CreateUserDialog onDone={fetchUsers} />}
      />

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <ul className="divide-y divide-hairline">
          {users.map((u, i) => {
            const initials = (u.name || "?").split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();
            return (
              <li key={u.id} className="py-6 grid grid-cols-12 gap-6 items-center" data-testid={`user-row-${u.email}`}>
                <span className="col-span-1 smallcaps text-ink-400 font-mono">{(i + 1).toString().padStart(2, "0")}</span>
                <div className="col-span-4 flex items-center gap-4">
                  <span className="w-10 h-10 bg-ink-900 text-cream flex items-center justify-center font-display text-sm">{initials}</span>
                  <div>
                    <p className="font-display text-lg leading-tight">{u.name}</p>
                    <p className="smallcaps text-ink-400 font-mono">{u.email}</p>
                  </div>
                </div>
                <div className="col-span-3">
                  <Select value={u.role} onValueChange={(v) => updateRole(u, v)} disabled={u.id === me?.id}>
                    <SelectTrigger className="border-0 border-b border-ink-200 rounded-none pl-2 pr-6 text-sm font-display italic"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <Switch checked={u.active} onCheckedChange={() => toggleActive(u)} disabled={u.id === me?.id} data-testid={`toggle-user-${u.email}`} />
                  <StatusBadge status={u.active ? "active" : "retired"} />
                </div>
                <div className="col-span-2 text-right">
                  {u.id !== me?.id && (
                    <button onClick={() => remove(u)} className="smallcaps ink-link text-oxblood" data-testid={`delete-user-${u.email}`}>
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
