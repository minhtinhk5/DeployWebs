import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from "typeorm";
import { Section } from "./Section.entity";
import { CourseProgress } from "./CourseProgress.entity";

@Entity("sub_sections")
export class SubSection {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column()
  timeDuration: string;

  @Column({ type: "text" })
  description: string;

  @Column({ length: 500 })
  videoUrl: string;

  @Column({ type: "int", default: 0 })
  order: number;

  @Column({ default: false })
  isPreview: boolean;

  @ManyToOne(() => Section, (section) => section.subSection, { onDelete: "CASCADE" })
  section: Relation<Section>;

  @ManyToOne(
    () => CourseProgress,
    (courseProgress) => courseProgress.completedVideos,
    { onDelete: "SET NULL" }
  )
  completedVideos: Relation<CourseProgress>;
}
