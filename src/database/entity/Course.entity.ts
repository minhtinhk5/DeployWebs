import {
  Index,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Entity,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from "typeorm";
import { User } from "./User.entity";
import { Category } from "./Category.entity";
import { RatingsAndReviews } from "./RatingsAndReviews.entity";
import { Section } from "./Section.entity";

export enum Status {
  DRAFT = "Draft",
  PUBLIC = "Public",
}

@Entity("courses")
// Index: catalog lọc status=Public và sắp xếp theo ngày tạo
@Index("idx_courses_status_created", ["status", "createdAt"])
export class Course {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: false })
  courseName: string;

  @Column({ type: "text", nullable: false })
  courseDescription: string;

  @ManyToOne(() => Category, (category) => category.courses, { onDelete: "SET NULL" })
  category: Relation<Category>;

  @OneToMany(() => Section, (section) => section.course)
  courseContent: Relation<Section[]>;

  @ManyToOne(() => User, (user) => user.uploadedCourses, { onDelete: "CASCADE" })
  instructor: Relation<User>;

  @OneToMany(
    () => RatingsAndReviews,
    (ratingsAndReviews) => ratingsAndReviews.course
  )
  ratingsAndReviews: Relation<RatingsAndReviews[]>;

  @Column("double", { nullable: false })
  price: number;

  @ManyToMany(() => User, (user) => user.courses)
  studentsEnrolled: Relation<User[]>;

  @Column({ nullable: true })
  thumbnail: string;

  @Column("simple-json", { nullable: true })
  tag: string[];

  @Column("simple-json", { nullable: true })
  instructions: string[];

  @Column({ type: "text" })
  whatYouWillLearn: string;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt: Date;

  @CreateDateColumn({ type: "timestamp" })
  createdAt: Date;

  @Column({
    type: "enum",
    enum: Status,
    default: Status.DRAFT,
  })
  status: Status;
}
