import {
  Index,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from "typeorm";
import { Profile } from "./Profile.entity";
import { Course } from "./Course.entity";
import { RatingsAndReviews } from "./RatingsAndReviews.entity";
import { CourseProgress } from "./CourseProgress.entity";

export enum AccountType {
  ADMIN = "Admin",
  STUDENT = "Student",
  INSTRUCTOR = "Instructor",
}

@Entity("users")
// Index: thống kê theo loại tài khoản & người dùng mới theo thời gian
@Index("idx_users_type_created", ["accountType", "createdAt"])
@Index("idx_users_created", ["createdAt"])
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true, nullable: false })
  email: string;

  @Column()
  password: string;

  @Column()
  contactNumber: string;

  @Column()
  image: string;

  @Column({ type: "varchar", nullable: true })
  verificationOtp: string | null;

  @Column({ type: "datetime", nullable: true })
  otpExpires: Date | null;

  @Column({ default: false })
  isSignedIn: boolean;

  @OneToOne(() => Profile, (profile) => profile.user)
  @JoinColumn()
  additionalInformation: Relation<Profile>;

  @OneToMany(
    () => RatingsAndReviews,
    (ratingsAndReviews) => ratingsAndReviews.user
  )
  ratingsAndReviews: Relation<RatingsAndReviews[]>;

  // Sửa: ManyToMany phải dùng @JoinTable (bản cũ dùng @JoinColumn nên không có bảng nối)
  @ManyToMany(() => Course, (course) => course.studentsEnrolled)
  @JoinTable()
  courses: Relation<Course[]>;

  @OneToMany(() => Course, (course) => course.instructor)
  uploadedCourses: Relation<Course[]>;

  @Column({ default: true })
  active: boolean;

  @Column({ default: true })
  approved: boolean;

  @Column({ type: "varchar", nullable: true })
  token: string | null;

  @Column({ type: "datetime", nullable: true })
  tokenExpires: Date | null;

  // ===== Telegram =====
  @Column({ type: "varchar", length: 32, nullable: true, unique: true })
  telegramChatId: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  telegramUsername: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  telegramLinkCode: string | null;

  @Column({ type: "datetime", nullable: true })
  telegramLinkCodeExpires: Date | null;

  @Column({ default: true })
  telegramLoginAlert: boolean;

  @Column({
    type: "enum",
    enum: AccountType,
  })
  accountType: AccountType;

  @OneToMany(() => CourseProgress, (courseProgress) => courseProgress.user)
  courseProgress: Relation<CourseProgress[]>;

  @CreateDateColumn({ type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt: Date;
}
