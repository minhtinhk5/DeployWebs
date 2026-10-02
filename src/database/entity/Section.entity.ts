import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from "typeorm";
import { Course } from "./Course.entity";
import { SubSection } from "./SubSection.entity";

@Entity("sections")
export class Section {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  sectionName: string;

  @Column({ type: "int", default: 0 })
  order: number;

  @ManyToOne(() => Course, (course) => course.courseContent, { onDelete: "CASCADE" })
  course: Relation<Course>;

  @OneToMany(() => SubSection, (subSection) => subSection.section)
  subSection: Relation<SubSection[]>;
}
