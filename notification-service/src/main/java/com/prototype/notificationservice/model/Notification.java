package com.prototype.notificationservice.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "notifications")
public class Notification {

    @Id
    private String id;

    @Indexed
    private Long userId;

    private String type;
    private String title;
    private String message;
    private boolean read;
    private boolean broadcast;

    private List<Long> dismissedByUserIds = new ArrayList<>();

    @Indexed(expireAfterSeconds = 2592000)
    private Instant createdAt;

    public Notification() {}

    public Notification(Long userId, String type, String title, String message) {
        this.userId               = userId;
        this.type                 = type;
        this.title                = title;
        this.message              = message;
        this.read                 = false;
        this.broadcast            = false;
        this.createdAt            = Instant.now();
        this.dismissedByUserIds   = new ArrayList<>();
    }

    public static Notification broadcast(String type, String title, String message) {
        Notification n = new Notification();
        n.type                  = type;
        n.title                 = title;
        n.message               = message;
        n.broadcast             = true;
        n.read                  = false;
        n.createdAt             = Instant.now();
        n.dismissedByUserIds    = new ArrayList<>();
        return n;
    }

    public String getId()                           { return id; }
    public Long getUserId()                         { return userId; }
    public String getType()                         { return type; }
    public String getTitle()                        { return title; }
    public String getMessage()                      { return message; }
    public boolean isRead()                         { return read; }
    public boolean isBroadcast()                    { return broadcast; }
    public Instant getCreatedAt()                   { return createdAt; }
    public List<Long> getDismissedByUserIds()       { return dismissedByUserIds; }

    public void setRead(boolean read)               { this.read = read; }
    public void setDismissedByUserIds(List<Long> d) { this.dismissedByUserIds = d; }
}