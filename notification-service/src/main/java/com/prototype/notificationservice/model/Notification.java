package com.prototype.notificationservice.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "notifications")
public class Notification {

    @Id
    private String id;

    @Indexed
    private Long userId;      // null for broadcasts

    private String type;
    private String title;
    private String message;
    private boolean read;
    private boolean broadcast; // true = visible to all users, not tied to a single userId

    @Indexed(expireAfterSeconds = 2592000) // auto-delete after 30 days
    private Instant createdAt;

    public Notification() {}

    public Notification(Long userId, String type, String title, String message) {
        this.userId     = userId;
        this.type       = type;
        this.title      = title;
        this.message    = message;
        this.read       = false;
        this.broadcast  = false;
        this.createdAt  = Instant.now();
    }

    public static Notification broadcast(String type, String title, String message) {
        Notification n = new Notification();
        n.type      = type;
        n.title     = title;
        n.message   = message;
        n.broadcast = true;
        n.read      = false;
        n.createdAt = Instant.now();
        return n;
    }

    public String getId()           { return id; }
    public Long getUserId()         { return userId; }
    public String getType()         { return type; }
    public String getTitle()        { return title; }
    public String getMessage()      { return message; }
    public boolean isRead()         { return read; }
    public boolean isBroadcast()    { return broadcast; }
    public Instant getCreatedAt()   { return createdAt; }
    public List<Long> getDismissedByUserIds()       { return dismissedByUserIds; } // ADD THIS

    public void setRead(boolean read) { this.read = read; }
    public void setDismissedByUserIds(List<Long> d) { this.dismissedByUserIds = d; } // ADD THIS

}
