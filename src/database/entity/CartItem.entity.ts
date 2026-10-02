import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from "typeorm";
import { User } from "./User.entity";
import { Course } from "./Course.entity";

@Entity("cart_items")
@Unique(["user", "course"])
export class CartItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: Relation<User>;

  @ManyToOne(() => Course, { onDelete: "CASCADE", eager: false })
  course: Relation<Course>;

  @CreateDateColumn({ type: "timestamp" })
  createdAt: Date;
}
