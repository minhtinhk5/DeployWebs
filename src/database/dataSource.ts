import { DataSource } from "typeorm";
import { RatingsAndReviews } from "./entity/RatingsAndReviews.entity";
import { Profile } from "./entity/Profile.entity";
import { User } from "./entity/User.entity";
import { Course } from "./entity/Course.entity";
import { Category } from "./entity/Category.entity";
import { CourseProgress } from "./entity/CourseProgress.entity";
import { Section } from "./entity/Section.entity";
import { SubSection } from "./entity/SubSection.entity";
import { CartItem } from "./entity/CartItem.entity";
import { Order } from "./entity/Order.entity";

export const AppDataSource = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Tự tạo/cập nhật bảng theo entity. Đặt DB_SYNC=false khi đã ổn định để tránh mất dữ liệu.
  synchronize: process.env.DB_SYNC !== "false",
  logging: false,
  entities: [
    User,
    Course,
    Category,
    CourseProgress,
    Profile,
    RatingsAndReviews,
    Section,
    SubSection,
    CartItem,
    Order,
  ],
});

const InitializeDatabase = async () => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log("Connected to Database Successfully.");
    }
  } catch (error) {
    console.error("Error while making connection to Database. ", error);
  }
};

export default InitializeDatabase;
