import {
  Index,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from "typeorm";
import { User } from "./User.entity";

export enum OrderStatus {
  PENDING = "Pending",
  PAID = "Paid",
  REJECTED = "Rejected",
  CANCELLED = "Cancelled",
}

export type OrderLine = { courseId: string; name: string; price: number };

@Entity("orders")
// Index: admin lọc đơn theo trạng thái + thời gian; học viên xem đơn của mình theo trạng thái
@Index("idx_orders_status_created", ["status", "createdAt"])
@Index("idx_orders_user_status", ["user", "status"])
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** Mã ngắn để ghi vào nội dung chuyển khoản, VD: SN8F3K2Q */
  @Column({ type: "varchar", length: 20, unique: true })
  code: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: Relation<User>;

  @Column("simple-json")
  items: OrderLine[];

  @Column("double")
  amount: number;

  @Column({ type: "enum", enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @CreateDateColumn({ type: "timestamp" })
  createdAt: Date;

  @Column({ type: "datetime", nullable: true })
  paidAt: Date | null;
}
