package com.prototype.orderservice.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "market_status")
public class MarketStatus {

    @Id
    private Long id = 1L;

    private boolean open = true;

    public Long getId() { return id; }
    public boolean isOpen() { return open; }
    public void setOpen(boolean open) { this.open = open; }
}