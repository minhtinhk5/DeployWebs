import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from "typeorm";
import { User } from "./User.entity";
import { SubSection } from "./SubSection.entity";

@Entity("course_progress")
@Index(["courseId", "user"])
export class CourseProgress {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  courseId: string;

  @ManyToOne(() => User, (user) => user.courseProgress, { onDelete: "CASCADE" })
  user: Relation<User>;

  // (cũ, không dùng) giữ lại để không phá schema
  @OneToMany(() => SubSection, (subSection) => subSection.completedVideos)
  completedVideos: Relation<SubSection[]>;

  /** Danh sách id bài học đã hoàn thành */
  @Column("simple-json", { nullable: true })
  completedLectures: string[] | null;

  @Column({ type: "varchar", length: 36, nullable: true })
  lastLectureId: string | null;

  @UpdateDateColumn({ type: "timestamp", nullable: true })
  updatedAt: Date;
}
