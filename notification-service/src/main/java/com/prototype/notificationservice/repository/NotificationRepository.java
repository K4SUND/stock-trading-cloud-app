package com.prototype.notificationservice.repository;

import com.prototype.notificationservice.model.Notification;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface NotificationRepository extends MongoRepository<Notification, String> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<Notification> findByBroadcastTrueOrderByCreatedAtDesc();
    List<Notification> findByUserIdAndReadFalse(Long userId);
    long countByUserIdAndReadFalse(Long userId);

    // ADD THIS — broadcasts not yet dismissed by this user
    List<Notification> findByBroadcastTrueAndDismissedByUserIdsNotContaining(Long userId);
}