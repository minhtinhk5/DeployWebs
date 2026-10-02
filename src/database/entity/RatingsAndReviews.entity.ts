import {
  Index,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  type Relation,
} from "typeorm";
import { User } from "./User.entity";
import { Course } from "./Course.entity";

@Entity("ratings_and_reviews")
// Index: lấy đánh giá cao mới nhất (trang chủ)
@Index("idx_reviews_rating_created", ["rating", "createdAt"])
@Unique(["user", "course"]) // mỗi học viên chỉ 1 đánh giá / khóa (được sửa)
export class RatingsAndReviews {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("float")
  rating: number;

  @Column({ type: "text", nullable: true })
  review: string | null;

  @ManyToOne(() => User, (user) => user.ratingsAndReviews, { onDelete: "CASCADE" })
  user: Relation<User>;

  @ManyToOne(() => Course, (course) => course.ratingsAndReviews, { onDelete: "CASCADE" })
  course: Relation<Course>;

  @CreateDateColumn({ type: "timestamp", nullable: true })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", nullable: true })
  updatedAt: Date;
}
